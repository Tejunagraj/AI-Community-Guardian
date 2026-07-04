import logging
import os
import sys

from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, '.env')
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
    template_folder="../frontend",
    static_folder="../frontend",
    static_url_path=""
)

CORS(app)

app.secret_key = os.getenv('SECRET_KEY', 'change-me-secret-key')
app.register_blueprint(routes)


@app.route("/")
def home():
    return send_from_directory("../frontend", "index.html")


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)