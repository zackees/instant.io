FROM node:12


# RUN npm install -g bittorrent-tracker
WORKDIR /app

COPY . .
RUN npm install
RUN npm run build

EXPOSE 80

# CMD ["bittorrent-tracker"]

CMD ["npm", "run", "start", "80"]
