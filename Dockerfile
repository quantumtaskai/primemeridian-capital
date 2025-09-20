FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]