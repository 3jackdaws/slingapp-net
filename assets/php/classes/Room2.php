<?php

/**
 * Room Class
 * Created by PhpStorm.
 * User: ian
 * Date: 10/16/16
 * Time: 5:53 PM
 */
require_once "interfaces/DatabaseObject.php";
require_once "classes/RoomCode.php";
require_once "classes/Account.php";
require_once "classes/Chat.php";

//Needs setter for number of rooms code uses
//Needs update screen name function
/**
 * This Class handles all Rooms in the application, and manages their creation
 * and deletion as well as adding and removing participants through its function
 * calls. This class has the ability to make rooms for temporary accounts as well
 * as permanent accounts. The participants generated in each rooms will exist for the
 * duration of the rooms, and can be rejoined by an account via the cookie unique
 * identity that each account will have based on its computer  and browser.
 */
class Room2 extends DatabaseObject
{
    /** @var RoomCode[] */
    private $invite_codes = [];
    /** @var Account[] */
    private $participants = [];
    private $id;
    private $name;
    private $remaining_uses;
    private $expiration_date;
    private $chat;
    //pass account object to constructor or just the needed parameters to factor out the select statement
    /**
     * Function Constructor
     * Room constructor.
     * @param $roomID
     * @throws Exception
     * This constructor will allow a rooms to be generated based on the creating participants
     * token, and given screen name, the roomID will act as a unique identifier for the rooms.
     * No rooms can exist without a participant.
     */
    public function __construct($room_id)
    {
        $this->id = $room_id;
        $this->chat = new Chat($room_id);

        $sql = "SELECT * FROM Rooms
                LEFT JOIN RoomAccount ra
                ON Rooms.RoomID = ra.RoomID
                LEFT JOIN Accounts ac
                ON ac.AccountID = ra.AccountID
                LEFT JOIN RoomCodes rc
                ON Rooms.RoomID = rc.RoomID
                WHERE Rooms.RoomID = :roomid";
        $statement = Database::connect()->prepare($sql);
        $statement->execute([":roomid" => $room_id]);
        $result = $statement->fetchAll(PDO::FETCH_ASSOC);

        if ($result != false) {
            $this->name = $result[0]["RoomName"];

            foreach ($result as $row) {
                if ($row["RoomCode"] != null){
                    $this->invite_codes[] = new RoomCode(
                        $row["RoomCode"],
                        $row["RoomID"],
                        $row["CreatedBy"],
                        $row["RemainingUses"],
                        $row["ExpirationDate"]);
                }

                elseif ($row["AccountID"] != null) {
                    /**
                     *          THIS WORKS, PLS NO TOUCH
                     */
                    $this->participants[] = new Account(
                        $row["AccountID"],
                        $row["LoginToken"],
                        $row["TokenGenTime"],
                        $row["Email"],
                        $row["FirstName"],
                        $row["LastName"],
                        $row["LastLogin"],
                        $row["JoinDate"],
                        $row["RoomID"],
                        $row["ScreenName"],
                        $row["AccountActive"]
                    );
                }
            }
        } else {
            throw new Exception("Room lookup failed");
        }
    }

    /**
     * Function createRoom
     * @param $room_name
     * @return Room
     * This Function will allow a rooms to be generated based on a token from
     * the account creating the rooms. This will allow both Account-Tests Users and
     * Temp Users to join the rooms.
     */
    public static function CreateRoom($room_name)
    {
        $id = Database::getFlakeID();
        $sql = "INSERT INTO Rooms (RoomID, RoomName) VALUES (:id, :name)";
        $statement = Database::connect()->prepare($sql);
        if (!$statement->execute([
            ":id" => $id,
            ":name" => $room_name
        ])) {
            return false;
        }
        return new Room($id);
    }

    public static function GetFromCode($code)
    {
        $sql = "SELECT RoomID FROM RoomCodes WHERE RoomCode = :rc";
        $statement = Database::connect()->prepare($sql);
        $result = $statement->execute([":rc" => $code]);
        if ($result) {
            $id = $statement->fetch()[0];
            return new Room($id);
        } else {
            return false;
        }
    }

    /**
     * @return mixed
     */
    public function getID()
    {
        return $this->id;
    }

    /**
     * @return mixed
     */
    public function getRoomName()
    {
        return $this->name;
    }

    /**
     * @param $newRoomName
     */
    public function setName($newRoomName)
    {
        $this->name = $newRoomName;
        $this->_has_changed = true;
    }

    public function accountInRoom($account_id)
    {
        foreach($this->participants as $account){
            if($account->getAccountID() == $account_id) return true;
        }
        return false;
    }

    /**
     * Function AddParticipant
     * @param Account $account
     * @param $screenName
     * @return integer
     * This Function allows a participant to be generated in a rooms based
     * on its account token (Temp or Perm) and a screenName that the
     * user provides. Checks how many uses are left and returns false if
     * no uses left.
     */
    public function addParticipant(Account $account)
    {
        $this->participants[] = $account;

        $sql = "INSERT INTO RoomAccount
                    (AccountID, RoomID)
                    VALUES (:acctid, :rmid)";
        return (Database::connect()->prepare($sql)->execute([
            ':acctid' => $account->getAccountID(),
            ':rmid' => $this->id
            ])) ? true : false;
    }


    /**
     * Function Delete
     * This function will remove a RoomCode, then all Participants, the the Room
     * that is targeted by it. This will allow referential integrity to remain valid
     * and the removal of the rooms from the active database.
     */
    public function delete()
    {
        $sql = "DELETE FROM RoomCodes WHERE RoomID=:roomid";
        if (!Database::connect()->prepare($sql)->execute([
            ":roomid" => $this->_roomID
        ])) {
            error_log(Database::connect()->errorInfo()[2]);
        }
        $this->invite_codes = [];

        $this->participants = [];

        $sql = "DELETE FROM RoomAccount WHERE RoomID=:roomid";
        if (Database::connect()->prepare($sql)->execute([":roomid" => $this->id])) {
            $sql = "DELETE FROM Rooms WHERE RoomID=:roomid";
            Database::connect()->prepare($sql)->execute([":roomid" => $this->id]);
        } else
            error_log(Database::connect()->errorInfo()[2]);
    }

    /**
     * Function deleteParticipant
     * @param $accountID
     * @return boolean
     * This function will remove the account's participant from the database.
     * This function uses an SQL statement in order to find an
     * existing participant based on an account's ID. If it succeeds in finding
     * and deleting the participant, it will return 'true'.
     * This function should be called when a rooms expires.
     */
    public function removeParticipant(Account $account)
    {
        $key = array_search($account, $this->participants);
        unset($this->participants[$key]);
        $sql = "DELETE FROM RoomAccount WHERE AccountID = :acc_id AND RoomID = :room_id";
        Database::connect()->prepare($sql)->execute([
            ":room_id" => $this->id,
            ":acc_id" => $account->getAccountID()
        ]);
    }

    /**
     * @return mixed
     */
    public function getUsesLeft()
    {
        return $this->remaining_uses;
    }

    public function setUsesLeft($uses, $code)
    {
        $this->_room_codes[$code]->setUses($uses);
        $this->_room_codes[$code]->update();
    }

    public function removeInviteCode($code)
    {
        $this->invite_codes[$code]->delete();
    }


    public function setParticipantInactive($accountID)
    {
        $retval = false;

        $sql = "SELECT a.RoomID
                FROM Accounts AS a
                  JOIN RoomCodes AS rc
                    ON a.RoomID = rc.RoomID
                WHERE AccountID = :accountID";
        $statement = Database::connect()->prepare($sql);
        $statement->execute(array(':accountID' => $accountID));

        if ($retval = Database::connect()->prepare($sql)->execute(array(':accountID' => $accountID))) {
            foreach ($this->_accounts as $a) {
                if ($a->getAccountID() == $accountID) {
                    $a->_active = false;
                }
            }
        }
        return $retval;
//        $retval = false;
//
//        $sql = "SELECT p.RoomID
//                FROM Participants AS p
//                  JOIN RoomCodes AS rc
//                    ON p.RoomID = rc.RoomID
//                WHERE AccountID = :accountID";
//        $statement = Database::connect()->prepare($sql);
//        $statement->execute(array(':accountID' => $accountID));
//        if ($result = $statement->fetch(PDO::FETCH_ASSOC)) {
//            $sql = "SELECT
//                    FROM RoomCodes
//                    WHERE RoomID = :roomID";
//            $statement = Database::connect()->prepare($sql);
//            if ($statement->execute(array(':roomID' => $result['RoomID']))) {
//
//                $sql = "SELECT *
//                    FROM Participants
//                    WHERE AccountID = :accountID";
//
//                if ($retval = Database::connect()->prepare($sql)->execute(array(':accountID' => $accountID))) {
//                    foreach ($this->_accounts as $a) {
//                        if ($a->getAccountID() == $accountID) {
//                            $a->_active = false;
//                        }
//                    }
//                }
//            }
//        }
//        return $retval;
    }

    /**
     * Function Update
     * This Function allows the update of an account and roomCode based
     * on the changes made in either the account or the roomCode.
     */
    public function update()
    {
        foreach ($this->_accounts as $account) {
            $account->update();
        }
        foreach ($this->_room_codes as $rc) {
            $rc->update();
        }
        if ($this->hasChanged()) $this->updateRoom();
    }

    /**
     * Function UpdateRoom
     * This Function Changes the currenr rooms name in the database.
     */
    private function updateRoom()
    {
        $sql = "UPDATE Rooms SET RoomName = :roomname WHERE RoomID = $this->_roomID";
        $statement = Database::connect()->prepare($sql);
        $statement->execute([":roomname" => $this->_roomName]);
    }

    /**
     * Function AddRoomCode
     * @param $accountID
     * @param null $uses
     * @param null $expires
     * @return RoomCode
     * This Function adds a roomCode to the given participant, and will allow for
     * specific settings such as the uses remaining for the key as well as the
     * datetime that the key will expire.
     */
    public function addRoomCode($accountID, $uses, $expires = null)
    {
        $retval = false;
        if (array_key_exists($accountID, $this->_accounts)) {

            $this->_room_codes[] = $retval = RoomCode::createRoomCode($this->_roomID, $accountID, $uses, $expires);

            if($uses && $uses > $this->_usesLeft) {
                $this->_usesLeft = $uses;
            }
//            $participantID = $this->_accounts[$accountID]->getParticipantID();
//            $this->_room_codes[] = $retval = RoomCode::createRoomCode($this->_roomID, $participantID, $uses, $expires);
        }
        return $retval;
    }

    /**
     * @return Account[]
     */
    public function getAccounts()
    {
        return $this->_accounts;
    }

    /**
     * @return array|null
     */
    public function getParticipants()
    {
        $participants = null;
        foreach ($this->_accounts as $p) {
            $participants[] = $p->getScreenName();
        }
        return $participants;
    }

    /**
     * @param $accountID
     * @return true|false
     */
    public function checkForAccountInRoom($accountID)
    {
        foreach ($this->_accounts as $p) {
            if($accountID == $p->getAccountID())
                return true;
        }
        return false;
    }

    /**
     * @return RoomCode[]
     */
    public function getRoomCodes()
    {
        return $this->_room_codes;
    }

    /**
     * @return Chat
     */
    public function getChat()
    {
        return $this->_chat;
    }


    /**
     * Function getJSON
     * @param bool $as_array
     * @return array|string
     * This Function allows the return of the encoded JSON object
     * to be used in different areas of the program.
     */
    public function getJSON($as_array = false)
    {
        $json = [];
        $json["Type"] = "Room";
        $json['Accounts'] = [];
        foreach ($this->_accounts as $a) {
            $json['Accounts'][$a->getAccountID()] = $a->getJSON(true);
            unset($json['Accounts'][$a->getAccountID()]["LoginToken"]);
        }

        $json['RoomCodes'] = [];
        foreach ($this->_room_codes as $p) {
            $json['RoomCodes'][$p->getCode()] = $p->getJSON(true);
        }

        $json["RoomID"] = $this->_roomID;
        $json["RoomName"] = $this->_roomName;

        if ($as_array)
            return $json;
        return json_encode($json);
    }

    public function addMessage($id, $room, $author, $content, $fileID = null){
        $this->_chat->addMessage($id, $room, $author, $content, $fileID);
    }

    public function getMessages(){
        return json_encode($this->_chat->getMessages(500));
    }


    /**
     * Function validateDownload
     * @param $fileid
     * @param $token
     * @return bool | File
     * This Function ensures the user requesting to download file
     * has permission
     */
    public function validateDownload($fileid, $token){

        foreach ($this->_accounts as $account)
            if($account->getToken() == $token)
                foreach($this->_chat->getFiles() as $file)
                    if($file->getFileID() == $fileid)
                        return $file;

        return false;
    }
}
