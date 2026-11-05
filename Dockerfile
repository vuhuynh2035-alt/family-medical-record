FROM nginx:alpine

# Sao chép cấu hình Nginx tối ưu cho PWA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Sao chép toàn bộ tệp ứng dụng vào Nginx web root
COPY . /usr/share/nginx/html

# Loại bỏ các file rác/không cần thiết trong container
RUN rm -rf /usr/share/nginx/html/node_modules \
           /usr/share/nginx/html/.git \
           /usr/share/nginx/html/.archive \
           /usr/share/nginx/html/tests \
           /usr/share/nginx/html/test-results \
           /usr/share/nginx/html/Dockerfile \
           /usr/share/nginx/html/docker-compose.yml \
           /usr/share/nginx/html/nginx.conf \
           /usr/share/nginx/html/*.bat \
           /usr/share/nginx/html/*.vbs \
           /usr/share/nginx/html/*.py \
           /usr/share/nginx/html/*.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
