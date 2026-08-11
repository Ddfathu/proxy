FROM alpine:latest
RUN apk add --no-cache gost
CMD ["gost", "-L", "tcp://:8080"]
