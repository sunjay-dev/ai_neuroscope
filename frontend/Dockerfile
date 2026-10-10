FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/index.html frontend/app.js frontend/styles.css /usr/share/nginx/html/

EXPOSE 80
