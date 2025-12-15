remove all green and blue from the app it looks horrible, make everything matte: see the image copy 

backend errors when tryting to rubn:
python C:\Users\Lucas\Github\RedditPainpoint\server\main.py
INFO:mongodb_store:Connected to MongoDB successfully
INFO:mongodb_store:Loaded metadata, scrape_in_progress: False
INFO:mongodb_store:Loaded 0 pain points from database
ERROR:mongodb_store:Error connecting to MongoDB: 'MongoDBStore' object has no attribute 'create_indexes'
INFO:mongodb_store:Updated metadata: {'last_updated': datetime.datetime(2025, 12, 14, 23, 8, 47, 174067), 'scrape_in_progress': False}
[nltk_data] Downloading package punkt_tab to
[nltk_data]     C:\Users\Lucas\AppData\Roaming\nltk_data...
[nltk_data]   Package punkt_tab is already up-to-date!
INFO:openai_analyzer:OpenAI client initialized successfully
DEBUG:urllib3.connectionpool:Starting new HTTPS connection (1): pypi.org:443
DEBUG:urllib3.connectionpool:https://pypi.org:443 "GET /pypi/praw/json HTTP/1.1" 200 36290
Version 7.7.1 of praw is outdated. Version 7.8.1 was released Friday October 25, 2024.
INFO:openai_analyzer:OpenAI client initialized successfully
Traceback (most recent call last):
  File "C:\Users\Lucas\Github\RedditPainpoint\server\main.py", line 1, in <module>
    from app import app
  File "C:\Users\Lucas\Github\RedditPainpoint\server\app.py", line 51, in <module>
    from routes import initialize_routes
  File "C:\Users\Lucas\Github\RedditPainpoint\server\routes.py", line 3, in <module>
    from api import (
ImportError: cannot import name 'HealthCheck' from 'api' (C:\Users\Lucas\Github\RedditPainpoint\server\api.py)
PS C:\Users\Lucas\Github\RedditPainpoint\server> 


looks like you havent made the healthcheck api endpoint yet, and or havent tested it fully and ran the backend