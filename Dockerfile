FROM node:18-alpine3.15


# RUN npm install -g bittorrent-tracker
WORKDIR /app

COPY . .
RUN npm install
RUN npm run build

EXPOSE 80

CMD ["npm", "run", "start", "80"]
