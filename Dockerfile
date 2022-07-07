FROM node:12

WORKDIR /instant.io
COPY . .
RUN npm install
RUN npm run build

EXPOSE 80

CMD ["npm", "run", "start", "80"]
