#!/bin/bash
# Script tự động cập nhật và khởi chạy Family Health Manager trên Docker (Proxmox Server)

echo "=== DANG DONG BO VA CAP NHAT FAMILY HEALTH MANAGER TREN DOCKER ==="
git pull origin master
docker compose down
docker compose up -d --build
echo "=== TRIEN KHAI THANH CONG! ==="
echo "Truy cap tren trinh duyet: http://$(hostname -I | awk '{print $1}'):8082"
