FROM node:12

RUN git clone https://github.com/zackees/instant.io
WORKDIR /instant.io
RUN npm install
RUN npm run build

EXPOSE 80

CMD ["npm", "run", "start", "80"]
