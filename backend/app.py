import logging
import os
import sys

from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, '.env')
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))
load_dotenv(ENV_PATH, override=True)

logging.basicConfig(level=logging.INFO)

print('==================================================')
print(f'GROQ_API_KEY = {"SET" if os.getenv("GROQ_API_KEY") else "NOT FOUND"}')
print(f'GROQ_MODEL = {os.getenv("GROQ_MODEL") or "llama-3.3-70b-versatile"}')
print(f'Current .env path = {ENV_PATH}')
print('==================================================')

if not os.getenv('GROQ_API_KEY'):
    print('ERROR: GROQ_API_KEY NOT FOUND')

sys.path.insert(0, BASE_DIR)
from routes import routes

app = Flask(
    __name__,
    template_folder=FRONTEND_DIR,
    static_folder=FRONTEND_DIR,
    static_url_path=""
)

CORS(app)

app.secret_key = os.getenv('SECRET_KEY', 'change-me-secret-key')
app.register_blueprint(routes)


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)