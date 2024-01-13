from aiohttp import web
from prompts.validate_task import validate_task
from prompts.general_q import general_q
from format.format_messages import format_messages
from Thread import Thread


# dictionary to store all active threads - key: user_id, value: Thread object
# once a task is finished, it gets saved to a database and deleted from this dictionary in server RAM
threads = {}


# send index.html to client
async def send_index(request):
    with open('../client/index.html', 'r') as file:
        return web.Response(text=file.read(), content_type='text/html')

# handle post requests from client, send msg to API, and return response
async def handle_request(request):
    try:
        request_data = await request.json()
        req_type = request_data['type']
        # if request is an initial submission from web app
        if (req_type == 'task'):
            messages = format_messages(request_data['messages'])
            prompt = messages[-1]['content'][0]['text']

            # checks to see if the request is a computer task to be completed (needs to open a tab)
            is_task = validate_task(prompt)

            # if the prompt is a task (needs to open a tab)
            if (is_task):
                thread = Thread(prompt)
                threads[thread.thread_id] = thread
                action = thread.get_action()
                return web.json_response(action)
             
            # if the request is a general question/prompt (doesn't need to open a tab)
            else:
                response = general_q(messages)
                return web.json_response(response)
            
        # if the request is from an update from the chrome extension's browser tab
        elif (req_type == 'update'):
            print("update request received")
            base64_image =request_data.get('messages')[-1].get('screenshot')

            id = request_data.get('thread_id')

            elements = request_data.get('messages')[-1].get('elements')
            action = threads[id].get_action(image_url=base64_image, elements=elements)

            return web.json_response(action)            
        elif (req_type == 'task_question_response'):
            id = request_data.get('id')
            prompt = messages[-1]['content'][0]['text']
            action = threads[id].get_action(prompt=prompt)
            return web.json_response(action)

        else:
            print("invalid request type")
            return web.Response(status=500)
        
    except Exception as e:
        print("error: ", e)
        return web.Response(status=500)

# set max size of request to 20mb
max_size = 20 * 1024 * 1024

app = web.Application(client_max_size=max_size)
app.router.add_post('/api', handle_request)
app.router.add_static('/static/', path='../client/static', name='static')
app.router.add_get('/', send_index)
web.run_app(app, host='localhost', port=5000)