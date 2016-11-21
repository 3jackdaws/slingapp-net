<?php
/**
 * Created by PhpStorm.
 * User: ian
 * Date: 11/19/16
 * Time: 12:40 PM
 */


require_once realpath($_SERVER["DOCUMENT_ROOT"]) . "/assets/php/components/StandardHeader.php";
require_once "classes/Room.php";

$p = GetParams("action", "roomname", "screenname", "token");

switch ($p['action']) {
    case "create":
        $room = Room::createRoom($p["roomname"], $p["token"], null);
        if($room){
            echo $room->getJSON();
        }else{
            echo json_encode(["error"=>"Could not lookup account"]);
        }
        break;
    case "join":

}