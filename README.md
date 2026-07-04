# 🛡️ AI Community Guardian

**Smart Solutions for Safer Communities**

An innovative AI-powered web application for reporting civic issues, emergency assistance, and community support. Built for the Hack2Skill Gen AI Hackathon under the theme "AI for Better Living and Smarter Communities."

## 🌟 Features

### 1. **AI Chat Assistant** 💬
- Intelligent conversational AI powered by Google Gemini
- Real-time responses to community-related questions
- Safety tips, emergency procedures, and civic guidance
- Chat history tracking
- Responsive and interactive interface

### 2. **Image Analyzer** 📸
- Upload images of civic issues
- AI-powered detection of common problems:
  - 🗑️ Garbage and waste accumulation
  - 🕳️ Potholes and road damage
  - 💡 Broken streetlights
  - 💧 Water leakage and flooding
  - 🌳 Fallen trees and vegetation damage
  - Other civic infrastructure issues
- Detailed analysis with severity levels
- Supports PNG, JPG, JPEG, GIF, WebP formats
- File size limit: 10MB

### 3. **Complaint Report Generator** 📋
- Generate professional, formal complaint reports
- Ready to file with municipal authorities
- Copy to clipboard or download as text file
- Includes issue summary, details, impact, and recommendations

### 4. **Emergency Services Locator** 🚨
- Find nearby hospitals, police stations, fire services, and ambulances
- Browser geolocation integration
- Distance information
- 24/7 availability status
- Quick access to emergency contacts

### 5. **Emergency Contact Numbers** ☎️
- Indian emergency services:
  - 🚔 Police (112)
  - 🚑 Ambulance (108)
  - 🚒 Fire (101)
  - 👩 Women Helpline (1091)
  - ⚠️ Disaster Management (1070)
  - 👶 Child Helpline (1098)
  - 🚂 Railway Emergency (1512/1234)
  - ☠️ Poison Control (1800-11-6117)

## 🛠️ Tech Stack

- **Backend**: Python 3 with Flask
- **AI/ML**: Google Gemini API (google-generativeai SDK)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Image Processing**: Pillow
- **Configuration**: python-dotenv
- **Web Framework**: Flask with CORS support

## 📁 Project Structure

```
AI-Community-Guardian/
│
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── routes.py              # API endpoints
│   ├── gemini.py              # Gemini API integration
│   ├── requirements.txt        # Python dependencies
│   └── .env                   # Environment variables
│
├── frontend/
│   ├── index.html             # Main HTML page
│   ├── style.css              # Styling with glassmorphism
│   └── script.js              # Client-side functionality
│
├── uploads/                   # Image upload directory
│
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip (Python package manager)
- Google Gemini API key (free tier available)

### Installation

1. **Clone or download the repository**
   ```bash
   cd AI-Community-Guardian
   ```

2. **Create and activate virtual environment** (Optional but recommended)
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   
   # macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   # Edit .env file in backend/
   GEMINI_API_KEY=your_actual_api_key_here
   FLASK_ENV=development
   FLASK_DEBUG=False
   FLASK_HOST=127.0.0.1
   FLASK_PORT=5000
   ```

   **Get your Gemini API Key:**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click "Create API Key"
   - Copy your key and paste it in `.env`

5. **Run the application**
   ```bash
   # From backend directory
   python app.py
   ```

6. **Access the application**
   - Open your browser and go to: `http://localhost:5000`

## 📱 Usage Guide

### Chat Assistant
1. Navigate to the **💬 Chat** section
2. Type your question about community issues, emergency procedures, or safety
3. Get instant AI-powered responses
4. Chat history is maintained during the session

### Report Civic Issues
1. Go to the **📸 Analyze** section
2. Upload an image of the civic issue (drag & drop or click)
3. Click **🔍 Analyze Image**
4. Review the AI analysis
5. Click **📝 Generate Report** to create a professional complaint
6. Copy or download the report

### Find Emergency Services
1. Scroll to **🚨 Emergency** section
2. Click **📍 Find Services Near Me**
3. Allow location access when prompted
4. View nearby hospitals, police stations, fire services, and ambulances

### Emergency Numbers
- Scroll to **☎️ Emergency Contact Numbers** section
- All important Indian emergency numbers are displayed
- Save them in your phone for quick access

## 🔐 Security Features

- ✅ All inputs are validated on both frontend and backend
- ✅ API keys are stored in `.env` file (never hardcoded)
- ✅ File uploads are sanitized and validated
- ✅ Maximum file size limits enforced
- ✅ CORS enabled for secure cross-origin requests
- ✅ Proper error handling without exposing sensitive information
- ✅ Session-based security for user interactions

## 🎨 Design Features

- **Blue Gradient Theme**: Modern, professional color scheme
- **Glassmorphism Cards**: Frosted glass effect with transparency
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Smooth Animations**: Polished transitions and interactions
- **Loading Spinners**: User-friendly loading indicators
- **Error Messages**: Clear feedback on issues
- **Accessibility**: Respects user's reduced motion preferences

## 🔧 API Endpoints

### Health Check
```
GET /api/health
```
Returns application status and Gemini configuration.

### Chat
```
POST /api/chat
Content-Type: application/json

{
    "message": "User's question"
}

Response:
{
    "success": true/false,
    "response": "AI's response",
    "timestamp": "ISO timestamp"
}
```

### Image Analysis
```
POST /api/analyze-image
Content-Type: multipart/form-data

Form data:
- image: [image file]

Response:
{
    "success": true/false,
    "analysis": "Detailed analysis of the image",
    "filename": "uploaded filename"
}
```

### Generate Report
```
POST /api/generate-report
Content-Type: application/json

{
    "analysis": "Image analysis text from previous request"
}

Response:
{
    "success": true/false,
    "report": "Professional complaint report"
}
```

### Emergency Services
```
GET /api/emergency-services?latitude=28.6139&longitude=77.2090

Response:
{
    "success": true,
    "services": [
        {
            "type": "Hospital",
            "name": "Service name",
            "address": "Address",
            "phone": "+91 XXXX-XXXX-XXXX",
            "distance": "0.8 km",
            "available_24_7": true,
            "icon": "🏥"
        }
    ]
}
```

### Emergency Numbers
```
GET /api/emergency-numbers

Response:
{
    "success": true,
    "numbers": [
        {
            "service": "Police",
            "number": "112",
            "description": "Police Emergency",
            "icon": "🚔"
        }
    ]
}
```

## 🐛 Troubleshooting

### "GEMINI_API_KEY not found" error
- Make sure `.env` file exists in the `backend/` folder
- Verify the API key is correctly set
- Restart the Flask application

### "Module not found" errors
- Run `pip install -r requirements.txt` again
- Make sure you're in the backend directory
- Use the correct Python interpreter (check with `python --version`)

### Port 5000 already in use
- Change `FLASK_PORT` in `.env` to another port (e.g., 8000)
- Or kill the process using port 5000

### Images not uploading
- Check file size (max 10MB)
- Verify file format (PNG, JPG, JPEG, GIF, WebP)
- Check `uploads/` folder permissions

### Chat not responding
- Verify Gemini API key is valid
- Check network connection
- Review browser console for errors

## 🚀 Deployment

### Deploying to Production

1. **Update `.env` for production**
   ```
   FLASK_ENV=production
   FLASK_DEBUG=False
   FLASK_HOST=0.0.0.0  # For external access
   ```

2. **Use production WSGI server**
   ```bash
   pip install gunicorn
   gunicorn app:app
   ```

3. **Set up reverse proxy** (nginx/Apache)

4. **Enable HTTPS** (SSL/TLS certificates)

### Cloud Hosting Options
- Heroku
- AWS (EC2, App Runner)
- Google Cloud Platform
- Azure
- DigitalOcean

## 📊 Gemini API Limits

- Free tier: 60 requests per minute
- Requests limited to 5MB per file
- Rate limits apply per IP address

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Integration with real Google Maps API
- Database for complaint tracking
- User authentication system
- Multi-language support
- Mobile app
- Advanced analytics dashboard

## 📄 License

This project is open source and available for educational purposes.

## 🎓 Educational Value

This application demonstrates:
- ✅ Full-stack web development with Python and JavaScript
- ✅ Integration with modern AI APIs (Google Gemini)
- ✅ RESTful API design
- ✅ Frontend with responsive design
- ✅ Image processing and analysis
- ✅ Real-world problem solving for community welfare
- ✅ Best practices in code organization and security

## 💡 Future Enhancements

1. **User Accounts**: Registration and authentication
2. **Complaint Tracking**: Monitor status of filed complaints
3. **Community Dashboard**: Statistics and trends
4. **Mobile App**: Native iOS and Android apps
5. **Multilingual Support**: Support multiple languages
6. **Real-time Notifications**: Push notifications for emergencies
7. **Integration with Authorities**: Direct filing with municipal systems
8. **Community Rating System**: Rate and review services
9. **Video Upload**: Support for video evidence
10. **Advanced Analytics**: AI-powered insights about civic issues

## ⚡ Performance Tips

- Cache emergency numbers data
- Optimize image compression
- Use CDN for static files
- Implement request pagination
- Monitor API rate limits
- Regular database cleanup

## 📞 Support

For issues or questions:
1. Check the Troubleshooting section
2. Review console logs (`browser dev tools` and `terminal`)
3. Verify API key validity
4. Ensure all dependencies are installed

## 🏆 Built for

**Hack2Skill Gen AI Hackathon** - Theme: "AI for Better Living and Smarter Communities"

This application showcases how AI can be used to improve community welfare, public safety, and civic engagement through technology.

---

**Made with ❤️ for Better Communities** 🛡️ 🌍 ✨

*Empowering citizens with AI-powered tools for a smarter, safer community.*

**Last Updated**: June 2024
**Version**: 1.0.0
**Status**: Production Ready ✅
