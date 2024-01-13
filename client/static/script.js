let messages = []; // Store all messages here
const extensionId = "ehjpoiefjhmnbelangogfjphhhepegcp";
let onTaskQuestion = false;
let thread_id = null;
let performing_action = false;

$(document).ready(function() {
    // when a user submits a message
    $("#messageArea").on("submit", function(event) {
        var rawText = $("#text").val();

        addMessage(rawText, "user");
        if (onTaskQuestion) {
            getChatResponse("task_question_response");
            onTaskQuestion = false;
        } else {
            getChatResponse("task");
        }
        event.preventDefault();
    });
    
});

// Listen for messages from the background script
window.addEventListener("message", (event) => {
    if (event.origin == "http://localhost:5000" && event.data.type && event.data.type == "FROM_EXTENSION"
        && performing_action) {
        performing_action = false;
        console.log("Message recived from contentScript:", event.data);
        messages.push({role: "user", content: null, elements: event.data.data.elements, screenshot: event.data.data.screenshot, 
    thread_id: thread_id});
        getChatResponse("update");
    }
}); 

// add msg to chat window and 
function addMessage (msg, role) {
    var name= "", r = "";
    role == "user" ? name = "You" : name = "Zero";
    role == "action" ? r = "action" : r = name;

    var messageHtml = `<div class="container ${r}">
        <h1 class="user_name">${name}</h1>
        <p>${msg}</p>
    </div>`;

    $("#messages").append($.parseHTML(messageHtml));
    if (role == "user")
        $("#text").val("");
    // Scroll to the bottom
    $("#messages").scrollTop($("#messages")[0].scrollHeight);
    messages.push({role: role, content: msg});
}

function getChatResponse(type) {
    let data = { type: type, messages: messages };
    if (thread_id != null) {
        data.thread_id = thread_id;
    }
    $.ajax({
        data: JSON.stringify(data),
        contentType: "application/json",
        type: "POST",
        url: "/api",
    }).done(function(data) {
        if (data.hasOwnProperty("content")) {
            addMessage(data.content, "assistant");
        } else if (data.hasOwnProperty("function")) {
            performing_action = true;
            if (data.initiate_task == true) {
                thread_id = data.thread_id;
                addMessage("Opening a new tab...", "assistant");
            }
            if (data.function.name == "navigate_to_url") 
                addMessage("Navigating to URL: " + data.function.arguments.url, "assistant");
            else if (data.function.name == "search")
                addMessage("Searching: " + data.function.arguments.query, "assistant");
            else if (data.function.name == "click")
                addMessage("Clicking...", "assistant");
            else if (data.function.name == "type")
                addMessage("Typing: " + data.function.arguments.text, "assistant");
            else if (data.function.name == "ask_user"){
                addMessage(data.function.arguments.prompt, "assistant");
                onTaskQuestion = true;
                // don't send message to background.js
                return;
            } else if (data.function.name == "done") {
                addMessage("Ending task...", "assistant");
                thread_id = null;
            }
            data.type = "FROM_PAGE";
            window.postMessage(data);
        }
    });
}