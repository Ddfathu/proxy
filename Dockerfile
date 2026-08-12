FROM teddysun/xray:latest
COPY config.json /etc/xray/config.json
ENV PORT=8080
EXPOSE 8080
CMD ["xray", "run", "-config", "/etc/xray/config.json"]
