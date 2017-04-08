/**
 * Created by ian on 11/19/16.
 */


window.addEventListener("load", function () {
    Chat.init();
    Modal.init();
    Resource.load("/assets/php/components/modal/room_settings.php", "Settings", InitSettingsModal);
    Room.connect();
    window.document.title = Room.data.RoomName;
    document.getElementById("r-title").innerHTML = Room.data.RoomName;
    repopulateMessages();


});

function getCodeNodeList(code){
    //var label = ContextMenu.createLabel(code + " Options");

    //console.log("Menu Link");
    var setUses = ContextMenu.createMenuLink("Set Uses", "", function() {
        changeRemainingUses(code);
        ContextMenu.close();
    });


    var expiration = ContextMenu.createMenuLink("Set Expiration Date", "", function () {
        changeExpirationDate(code);
        ContextMenu.close();
    });

    var deleteCode = ContextMenu.createMenuLink("Delete", "", function () {
        deleteInviteCode(code);
        ContextMenu.close();
    });

    return [setUses, expiration, deleteCode];
}

function addCodeEvent(element){
    element.addEventListener("contextmenu", function (event) {
        // console.log(n.object.Code);
        //console.log(n);
        ContextMenu.create(event, getCodeNodeList(element.object.Code));
        return false;
    });
}


function addCodeButtonEvents() {
    var codes = Room.settings.optionsPanel.querySelector("#Invites").querySelectorAll("tr");

    console.log(close);

    codes.forEach(function (n) {
        //console.log("Button Test");

        n.addEventListener("contextmenu", function (event) {
            console.log(n.object.Code);
            //console.log(n);
            ContextMenu.create(event, getCodeNodeList(n.object.Code));
            return false;
        });
    });
}


var Chat = {
    chatlog: null,
    init: function () {
        Chat.chatlog = document.getElementById("chat");

    },
    send: function () {

    }
};

var Room = {
    data: null,
    socket: null,
    connected: false,
    connect: function () {
        if (!Room.data) return;
        var url = "wss:dev.slingapp.net/rooms/";
        if (window.location.host === "localhost") {
            url = "wss:localhost/rooms/";
        }
        url += Room.data.RoomID;

        console.log("Attempting to connect to ", url);
        Room.socket = new WebSocket(url);

        Room.socket.onopen = function () {
            Room.socket.send(JSON.stringify({
                action: "Register",
                token: Account.data.LoginToken,
                room: Room.data.ID
            }));
            Room.connected = true;
        };
        Room.socket.onmessage = function (data) {
            console.log(data.data);
            var message = JSON.parse(data.data);
            if (message.notify) {
                Toast.pop(textNode(message.notify), 3000);
            }
            var type = message.type;
            switch (type) {
                case "Message": {
                    var text = message.text;
                    var sender = message.sender;
                    var fileid = message.fileid;
                    putMessage(sender, text, null, fileid);

                } break;

                case "Participant Joined": {
                    var accountID = message.id;
                    var sn = message.nick;
                    Room.data.Accounts[accountID] = {ScreenName: sn, ID: accountID};
                    updateUsersHere();
                    newUserSet('small', null);
                } break;

                case "Confirmation": {
                    if (message.success === false) {
                        Toast.error(textNode("Action: " + message.action + " failed"));
                    }
                } break;

                case "Download": {
                    DownloadFile(message.filepath, message.filename);
                } break;
                case "Room Code Changed":
                {
                    Room.data.RoomCodes[message.inviteCode].UsesRemaining = message.uses;
                    updateInvites();
                } break;

                case "Room Code Deleted":
                {
                    Room.data.RoomCodes[message.inviteCode] = null;
                    updateInvites();
                }

                case "Participant Changed Their Name": {
                    updateUserInfo(message.id, message.nick);
                }break;

                default:{
                    console.info(message);
                }
            }
        };
        Room.socket.onerror = function (error) {
            Toast.error(textNode("Room Connection Error"));
            console.error(error);
        };
        setTimeout(function () {
            if (!Room.connected) {
                Toast.error(textNode("Could not connect to Room"));
            }
        }, 5000);
    },
    send: function (json) {
        if (Room.connected) {
            Room.socket.send(JSON.stringify(json));
        } else {
            Room.connect();
        }
    },
    sendMessage: function (message) {
        if (message.length <= 2000) {
            var json = {
                action: "Send Message",
                token: Account.data.LoginToken,
                text: message
            };

            Room.send(json);
        } else {
            alert("That message is too big!  Limit your messages to 2000 characters.");
        }
    },
    uploadFile: function (fileJSON) {
        fileJSON.action = "Send Message";
        fileJSON.token = Account.data.LoginToken;

        Room.send(fileJSON);
    },
    requestDownload: function (fileid) {
        Room.socket.send(JSON.stringify({
            action: "Download File",
            token: Account.data.LoginToken,
            fileid: fileid
        }));
    },
    getRoomCodes: function () {
        return Room.data.RoomCodes;
    },
    createRoomCode: function (uses, expires) {
        Room.socket.send(JSON.stringify({
            action: "Create Room Code",
            token: Account.data.LoginToken,
            uses: uses,
            expires: expires
        }));
    },
    settings: {
        categoryPanel: {
            links: null,
            node: null
        },
        optionsPanel: {
            panels: null,
            node: null
        }
    }

};

var Account = {
    data: null,
    login: function () {
        var token = GetToken();
        console.log(token);
        $.ajax({
            type: 'post',
            url: '/assets/php/components/account2.php',
            dataType: 'JSON',
            data: {
                action: "login",
                token: token
            },
            success: function (data) {
                console.log(data);
            },
            error: function (error) {
                console.log(error);
            }
        });
    }
};

function showSettings(){
    Modal.create("Settings", "darken");
}
function leaveRoom() {
    window.location.replace("https://dev.slingapp.net");
}

function InitSettingsModal() {
    Room.settings.categoryPanel.node = Resource.dictionary["Settings"].querySelector(".settings-left");
    Room.settings.optionsPanel = Resource.dictionary["Settings"].querySelector(".settings-right");
    Room.settings.categoryPanel.links = Room.settings.categoryPanel.node.querySelectorAll("a");
    Room.settings.optionsPanel.panels = Room.settings.optionsPanel.querySelectorAll(".settings-panel");

    Room.settings.categoryPanel.links.forEach(function (l) {
        l.addEventListener("click", function () {
            Room.settings.optionsPanel.panels.forEach(function (p) {
                p.removeClass("active");
            });
            Room.settings.categoryPanel.links.forEach(function (l) {
                l.removeClass("selected");
            });
            l.className += " selected";
            var id = l.getAttribute("href").slice(1);
            document.getElementById(id).className += " active";
        });
    });

    updateUsersHere();
    updateInvites();
    addCodeButtonEvents();
}

function updateUsersHere() {
    var userPanel = Room.settings.optionsPanel.querySelector("#Users");
    var here = userPanel.querySelector("#users-here");
    var you = userPanel.querySelector("#you");
    here.innerHTML = "";
    var loggedInUserID = Account.data.ID;
    you.innerHTML = "";
    you.innerHTML = "<span class='user' id='modalUsername'>" + Room.data.Accounts[loggedInUserID].ScreenName + "</span><br>" + you.innerHTML;
    for (var key in Room.data.Accounts) {
        if (Room.data.Accounts.hasOwnProperty(key)) {
            var account = Room.data.Accounts[key];
            if (account.ID != loggedInUserID)
                here.innerHTML += "<span class='user'>" + account.ScreenName + "</span><br>";
        }
    }
}

function createInviteCode(e) {
    var roomid = Room.data.RoomID;
    var token = GetToken();
    $.ajax({
        type: 'post',
        url: '/assets/php/components/room.php',
        dataType: 'JSON',
        data: {
            action: "gencode",
            room: roomid,
            token: token
        },
        success: function (data) {
            Room.data.RoomCodes[data.Code] = data;
            updateInvites();
        },
        error: function (error) {
            console.log(error);
        }
    });
}

function updateInvites(){
    var invitepanel = Room.settings.optionsPanel.querySelector("#Invites");
    var iCodeDiv = invitepanel.querySelector("#invite-codes");
    iCodeDiv.innerHTML = "";
    for (var code in Room.data.RoomCodes) {
        if (Room.data.RoomCodes.hasOwnProperty(code) && Room.data.RoomCodes[code] != null ) {
            var rc = Room.data.RoomCodes[code];
            var tr = document.createElement("tr");
            tr.object = rc;
            tr.innerHTML += "<td><input class='form-control iv-code' onclick='this.select()' readonly value='" + rc.Code + "'></td>";
            tr.innerHTML += "<td>" + Room.data.Accounts[rc.Creator].ScreenName + "</td>";
            tr.innerHTML += "<td>"  + (rc.UsesRemaining != null ? rc.UsesRemaining : "Unlimited") + "</td>";
            tr.innerHTML += "<td>"  + (rc.Expires != null ? rc.Expires : "none") + "</td>";

            iCodeDiv.appendChild(tr);
            addCodeEvent(tr);
        }

    }

}


function changeRemainingUses(code){
    var uses = prompt("Enter remaining uses:");
    event.preventDefault();
    event.stopPropagation();
    var token = GetToken();
    var json = {
        action:"Change Uses",
        remaining:uses,
        token:token,
        invite: code
    };
    Room.socket.send(JSON.stringify(json));

    updateInvites();
    return false;
}

function changeExpirationDate(code){
    var expires = prompt("Enter expiration date:", "mm/dd/yyyy");
    event.preventDefault();
    event.stopPropagation();
    var token = GetToken();
    var json = {
        action:"Change Expiration Date",
        expiration:expires,
        token:token,
        invite: code
    };
    Room.socket.send(JSON.stringify(json));
    updateInvites();
    //closeContextMenu();

    return false;
}

function deleteInviteCode(code){
    event.preventDefault();
    event.stopPropagation();
    var uses = 99;
    var token = GetToken();
    var json = {
        action:"Delete Code",
        token:token,
        remaining:uses,
        invite: code
    };
    Room.socket.send(JSON.stringify(json));
    updateInvites();
    //closeContextMenu();

    return false;
}



function changeScreenName(){
    var name = prompt("Enter a new nickname:");
    if(name.length > 0 && name[0] != " ") {
        event.preventDefault();
        event.stopPropagation();
        var token = GetToken();
        var json = {
            action: "Change Name",
            user: name,
            token: token
        };
        Room.socket.send(JSON.stringify(json));
        //Page reload needed
        updateUsersHere();
    }
    // return false;
}

function textNode(msg) {
    var text = document.createElement("text");
    text.innerHTML = msg;
    return text;
}

function snFromAccountID(id) {
    var len = Room.data.Accounts.length;
    for (var i = 0; i < len; i++) {
        if (Room.data.Accounts[i].ParticipantID == id) {
            return Room.data.Accounts[i].ScreenName;
        }
    }
}

function sendMessage() {
    var tarea = document.getElementById("send-box").querySelector("input");
    var text = tarea.value;
    if (text != "")
        Room.sendMessage(text);
    tarea.focus();
    tarea.value = "";

}

function uploadFile(files) {
    console.log("file specs: ", files);
    var file = files[0];
    var token = GetToken();
    if (file.size > 0) {
        var form = new FormData();
        var xhr = new XMLHttpRequest();
        form.append("action", "upload");
        form.append("token", token);
        form.append("upload", file);
        form.append("room", Room.data["RoomID"]);
        xhr.open("POST", "/assets/php/components/room.php");
        xhr.upload.addEventListener("progress", uploadProgress(), false);
        xhr.addEventListener("load", uploadComplete(this), false);
        xhr.addEventListener("error", uploadFailed(this), false);
        xhr.addEventListener("abort", uploadAbort(this), false);
        xhr.send(form);

        xhr.onreadystatechange = function () {
            if (xhr.readyState == XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    Room.uploadFile(response);
                } else {
                    console.log("Error", xhr.statusText);
                }
            }
        }
    }
}

function initDragDrop() {
    var chat = document.getElementById("upload-overlay");

    var doc = document;
    var xhr = new XMLHttpRequest();

    if (xhr.upload) {
        doc.addEventListener("dragover", function() {document.getElementById("upload-overlay").style.display = "block";}, false);
        //doc.addEventListener("dragleave", function() {document.getElementById("upload-overlay").style.display = "none";}, false);
        chat.addEventListener("dragover", displayOverlay, false);
        chat.addEventListener("dragleave", fileDragHover, false);
        chat.addEventListener("drop", fileSelectorHandler, false);
    }
}

function displayOverlay(e) {
    document.getElementById("upload-overlay").style.display = "block";
    fileDragHover(e);
}
function fileSelectorHandler(e) {
    document.getElementById("upload-overlay").style.display = "none";
    fileDragHover(e);
    uploadFile(e.dataTransfer.files);
}

function fileDragHover(e) {
    e.stopPropagation();    //prevent file drag from effecting parent nodes
    e.preventDefault();     //prevent web browser from responding when file is dragged over using default settings
    //e.target.className = (e.type == "dragover" ? "hover" : "");
}

function uploadProgress(e) {
    console.log("uploadProgress");
    // var progressNumber = document.getElementById('progressNumber');
    // var percentComplete = Math.round(e.loaded * 100 / e.total);
    // var progressBar = document.getElementById('prog');
    //
    // if(e.lengthComputable) {
    //     progressNumber.innerHTML = percentComplete + '%';
    //     progressBar.value = percentComplete;
    // } else {
    //     progressNumber.innerHTML = 'error';
    // }
}

function uploadComplete(e) {
    console.log("upload complete");
}

function uploadFailed(e) {
    console.log("error uploading file");
}

function uploadAbort(e) {
    console.log("upload canceled by user");
}

function updateScroll() {
    var element = document.getElementById("chat-log");
    var element2 = document.getElementById("file-log");

    element.scrollTop = element.scrollHeight;
    element2.scrollTop = element.scrollHeight;
}

function switchLog(logtype) {
    chat = document.getElementById('chat');
    chat_tab = document.getElementById('chat_tab');
    file_tab = document.getElementById('files_tab');

    console.log(chat_tab.className);
    console.log(chat.childNodes[1].style.display);
    if(logtype == 'files') {
        chat.childNodes[1].style.display = 'none';
        chat.childNodes[3].style.display = 'block';

        chat_tab.className = "nav-link chat_nav_button_inactive";
        file_tab.className = "nav-link chat_nav_button";
    }
    else {
        chat.childNodes[1].style.display = 'block';
        chat.childNodes[3].style.display = 'none';

        file_tab.className = "nav-link chat_nav_button_inactive";
        chat_tab.className = "nav-link chat_nav_button";
    }
}

function putMessage(sender, _text, before, fileid) {
    var text;
    if (fileid)
        text = "<a href='javascript:RequestDownload(" + fileid + ")'>" + _text + "</a>";
    else
        text = Autolinker.link(_text);

    var messageLog = document.getElementById("chat-log");
    var fileLog = document.getElementById("file-log");
    console.log(sender);
    var username = Room.data.Accounts[sender].ScreenName;
    var chat_messages = document.createElement("div");
    var file_messages = document.createElement("div");

    if (sender == Account.data.ID) {
        chat_messages.className = "message mine";
        file_messages.className = "message mine";
        username += " (you)";
    }
    else {
        chat_messages.className = "message";
        file_messages.className = "message";
    }
    chat_messages.innerHTML = "<span class='user'>" + username + "</span><br><span class='message-text'>" + text + "</span>";
    file_messages.innerHTML = "<span class='user'>" + username + "</span><br><span class='message-text'>" + text + "</span>";
    if (before) {
        messageLog.insertBefore(chat_messages, messageLog.firstChild);
        if(fileid)
            fileLog.insertBefore(file_messages, fileLog.firstChild);
    } else {
        messageLog.appendChild(chat_messages);
        if(fileid)
            fileLog.appendChild(file_messages);
    }
    updateScroll();
}

function DownloadFile(fileurl, filename) {
    var xhr = new XMLHttpRequest();

    xhr.open('GET', "https://".concat(fileurl));
    xhr.responseType = "arraybuffer";
    xhr.onload = function() {
        var blob = new Blob([xhr.response], {type: "application/octet-stream"});
        saveAs(blob, filename.concat(".zip"));
    }
    ;
    xhr.send(null);
}

function RequestDownload(fileid) {
    Room.requestDownload(fileid);
}

function repopulateMessages() {
    var before = false;
    for (var key in Messages) {
        if (Messages.hasOwnProperty(key)) {
            var sender = Messages[key].author;
            var text = Messages[key].content;
            var fileid = Messages[key].fileid;
            putMessage(sender, text, before, fileid);
            before = true;
        }
    }
}


function openInvites() {
    Modal.create("Settings", "darken");
    document.getElementById("InvitesLink").click();
}

