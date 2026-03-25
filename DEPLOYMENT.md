# Deployment Guide

## Production Deployment Checklist

### Backend (FastAPI)

#### 1. Environment Configuration

Update `.env` for production:
```env
CLOUDINARY_CLOUD_NAME=your_production_cloud
CLOUDINARY_API_KEY=your_production_key
CLOUDINARY_API_SECRET=your_production_secret
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
```

#### 2. Security Updates

In `main.py`, update CORS:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 3. Production Server

Install production server:
```bash
pip install gunicorn
```

Run with Gunicorn:
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

#### 4. Systemd Service (Linux)

Create `/etc/systemd/system/ai-interviewer.service`:
```ini
[Unit]
Description=AI Interviewer Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable ai-interviewer
sudo systemctl start ai-interviewer
```

### Frontend (React)

#### 1. Update API URL

Create `frontend/.env.production`:
```env
VITE_API_URL=https://api.yourdomain.com
```

Update `frontend/src/api/api.js`:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

#### 2. Build for Production

```bash
cd frontend
npm run build
```

This creates optimized files in `frontend/dist/`

#### 3. Deploy Static Files

Options:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag `dist` folder to Netlify
- **AWS S3 + CloudFront**
- **Nginx**: Serve from `/var/www/html`

### Nginx Configuration

#### Backend Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### Frontend Static Files

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/ai-interviewer/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### SSL/TLS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### Ollama in Production

#### Option 1: Local Installation
```bash
# Install Ollama on server
curl https://ollama.ai/install.sh | sh

# Pull model
ollama pull qwen2.5:7b-instruct

# Run as service
sudo systemctl enable ollama
sudo systemctl start ollama
```

#### Option 2: Docker
```dockerfile
FROM ollama/ollama:latest

RUN ollama pull qwen2.5:7b-instruct

EXPOSE 11434
CMD ["ollama", "serve"]
```

### Docker Deployment

#### Backend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
      - CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
      - CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  ollama_data:
```

### Cloud Deployment Options

#### AWS
- **Backend**: EC2 or ECS
- **Frontend**: S3 + CloudFront
- **Database**: RDS (if needed)

#### Google Cloud
- **Backend**: Cloud Run or Compute Engine
- **Frontend**: Cloud Storage + CDN
- **AI**: Consider Vertex AI as Ollama alternative

#### Azure
- **Backend**: App Service or Container Instances
- **Frontend**: Static Web Apps
- **AI**: Azure OpenAI Service

### Monitoring

#### Backend Health Check

Add to `main.py`:
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ollama": await check_ollama_connection()
    }
```

#### Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

### Performance Optimization

1. **Enable Caching**: Redis for session storage
2. **CDN**: CloudFlare for static assets
3. **Database**: PostgreSQL for persistent storage
4. **Load Balancing**: Multiple backend instances
5. **Compression**: Enable gzip in Nginx

### Security Best Practices

1. **API Keys**: Use environment variables
2. **HTTPS**: Always use SSL/TLS
3. **Rate Limiting**: Implement per-IP limits
4. **Input Validation**: Sanitize all inputs
5. **File Upload**: Limit size and types
6. **CORS**: Restrict to specific domains
7. **Authentication**: Add JWT tokens for production

### Backup Strategy

1. **Database**: Daily automated backups
2. **Cloudinary**: Files already backed up
3. **Code**: Git repository
4. **Configuration**: Encrypted .env backups

### Cost Estimation (Monthly)

- **Cloudinary Free Tier**: $0 (25 GB storage, 25 GB bandwidth)
- **AWS EC2 t3.medium**: ~$30
- **Domain + SSL**: ~$15
- **Total**: ~$45/month

### Scaling Considerations

- **Horizontal Scaling**: Add more backend instances
- **Caching**: Redis for frequently accessed data
- **Queue System**: Celery for async tasks
- **CDN**: Reduce server load
- **Database**: Connection pooling

### Maintenance

- **Updates**: Regular dependency updates
- **Monitoring**: Set up alerts for errors
- **Logs**: Rotate and archive logs
- **Backups**: Test restore procedures
- **Security**: Regular security audits
