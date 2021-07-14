### Webapp build
FROM node:16.3.0 as nodebuild

WORKDIR /webapp
ADD webapp/ /webapp

RUN npm install --no-optional && \
    npm run pack

### Go build
FROM golang:1.16.5 as gobuild

WORKDIR /go/src/focalboard
ADD . /go/src/focalboard

RUN  make server-linux
RUN mkdir /data

## Final image
FROM gcr.io/distroless/base-debian10

WORKDIR /opt/focalboard

COPY --from=gobuild --chown=nobody:nobody /data /data
COPY --from=nodebuild --chown=nobody:nobody /webapp/pack pack/
COPY --from=gobuild --chown=nobody:nobody /go/src/focalboard/bin/linux/focalboard-server bin/
COPY --from=gobuild --chown=nobody:nobody /go/src/focalboard/LICENSE.txt LICENSE.txt
COPY --from=gobuild --chown=nobody:nobody /go/src/focalboard/docker/server_config.json config.json

USER nobody

EXPOSE 8000/tcp

EXPOSE 8000/tcp 9092/tcp

VOLUME /data

CMD ["/opt/focalboard/bin/focalboard-server"]
