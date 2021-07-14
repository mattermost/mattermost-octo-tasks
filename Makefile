.PHONY: prebuild clean cleanall ci server server-mac server-linux server-win server-linux-package generate watch-server webapp mac-app win-app-wpf linux-app

PACKAGE_FOLDER = focalboard

# Build Flags
BUILD_NUMBER ?= $(BUILD_NUMBER:)
BUILD_DATE = $(shell date -u)
BUILD_HASH = $(shell git rev-parse HEAD)
# If we don't set the build number it defaults to dev
ifeq ($(BUILD_NUMBER),)
	BUILD_NUMBER := dev
endif

LDFLAGS += -X "github.com/mattermost/focalboard/server/model.BuildNumber=$(BUILD_NUMBER)"
LDFLAGS += -X "github.com/mattermost/focalboard/server/model.BuildDate=$(BUILD_DATE)"
LDFLAGS += -X "github.com/mattermost/focalboard/server/model.BuildHash=$(BUILD_HASH)"

all: webapp server

prebuild:
	cd webapp; npm install

ci: server-test
	cd webapp; npm run check
	cd webapp; npm run test
	cd webapp; npm run cypress:ci

server:
	$(eval LDFLAGS += -X "github.com/mattermost/focalboard/server/model.Edition=dev")
	cd server; go build -ldflags '$(LDFLAGS)' -o ../bin/focalboard-server ./main

server-mac:
	mkdir -p bin/mac
	$(eval LDFLAGS += -X "github.com/mattermost/focalboard/server/model.Edition=mac")
	cd server; env GOOS=darwin GOARCH=amd64 go build -ldflags '$(LDFLAGS)' -o ../bin/mac/focalboard-server ./main

server-linux:
	mkdir -p bin/linux
	$(eval LDFLAGS += -X "github.com/mattermost/focalboard/server/model.Edition=linux")
	cd server; env GOOS=linux GOARCH=amd64 go build -ldflags '$(LDFLAGS)' -o ../bin/linux/focalboard-server ./main

server-win:
	$(eval LDFLAGS += -X "github.com/mattermost/focalboard/server/model.Edition=win")
	cd server; env GOOS=windows GOARCH=amd64 go build -ldflags '$(LDFLAGS)' -o ../bin/win/focalboard-server.exe ./main

server-dll:
	$(eval LDFLAGS += -X "github.com/mattermost/focalboard/server/model.Edition=win")
	cd server; env GOOS=windows GOARCH=amd64 go build -ldflags '$(LDFLAGS)' -buildmode=c-shared -o ../bin/win-dll/focalboard-server.dll ./main

server-linux-package: server-linux webapp
	rm -rf package
	mkdir -p package/${PACKAGE_FOLDER}/bin
	cp bin/linux/focalboard-server package/${PACKAGE_FOLDER}/bin
	cp -R webapp/pack package/${PACKAGE_FOLDER}/pack
	cp server-config.json package/${PACKAGE_FOLDER}/config.json
	cp build/MIT-COMPILED-LICENSE.md package/${PACKAGE_FOLDER}
	cp NOTICE.txt package/${PACKAGE_FOLDER}
	cp webapp/NOTICE.txt package/${PACKAGE_FOLDER}/webapp-NOTICE.txt
	mkdir -p dist
	cd package && tar -czvf ../dist/focalboard-server-linux-amd64.tar.gz ${PACKAGE_FOLDER}
	rm -rf package

server-linux-package-docker:
	rm -rf package
	mkdir -p package/${PACKAGE_FOLDER}/bin
	cp bin/linux/focalboard-server package/${PACKAGE_FOLDER}/bin
	cp -R webapp/pack package/${PACKAGE_FOLDER}/pack
	cp server-config.json package/${PACKAGE_FOLDER}/config.json
	cp build/MIT-COMPILED-LICENSE.md package/${PACKAGE_FOLDER}
	cp NOTICE.txt package/${PACKAGE_FOLDER}
	cp webapp/NOTICE.txt package/${PACKAGE_FOLDER}/webapp-NOTICE.txt
	mkdir -p dist
	cd package && tar -czvf ../dist/focalboard-server-linux-amd64.tar.gz ${PACKAGE_FOLDER}
	rm -rf package

generate:
	cd server; go get -modfile=go.tools.mod github.com/golang/mock/mockgen
	cd server; go get -modfile=go.tools.mod github.com/jteeuwen/go-bindata
	cd server; go generate ./...

server-lint:
	@if ! [ -x "$$(command -v golangci-lint)" ]; then \
		echo "golangci-lint is not installed. Please see https://github.com/golangci/golangci-lint#install for installation instructions."; \
		exit 1; \
	fi; 
	cd server; golangci-lint run ./...
	cd mattermost-plugin; golangci-lint run ./...

server-test:
	cd server; go test -race -v ./...

server-doc:
	cd server; go doc ./...

watch-server:
	cd server; modd

watch-server-single-user:
	cd server; env FOCALBOARDSERVER_ARGS=--single-user modd

webapp:
	cd webapp; npm run pack

watch-webapp:
	cd webapp; npm run watchdev

mac-app: server-mac webapp
	rm -rf mac/temp
	rm -rf mac/dist
	rm -rf mac/resources/bin
	rm -rf mac/resources/pack
	mkdir -p mac/resources/bin
	cp bin/mac/focalboard-server mac/resources/bin/focalboard-server
	cp app-config.json mac/resources/config.json
	cp -R webapp/pack mac/resources/pack
	mkdir -p mac/temp
	xcodebuild archive -workspace mac/Focalboard.xcworkspace -scheme Focalboard -archivePath mac/temp/focalboard.xcarchive CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED="NO" CODE_SIGNING_ALLOWED="NO"
	mkdir -p mac/dist
	cp -R mac/temp/focalboard.xcarchive/Products/Applications/Focalboard.app mac/dist/
	# xcodebuild -exportArchive -archivePath mac/temp/focalboard.xcarchive -exportPath mac/dist -exportOptionsPlist mac/export.plist
	cp build/MIT-COMPILED-LICENSE.md mac/dist
	cp NOTICE.txt mac/dist
	cp webapp/NOTICE.txt mac/dist/webapp-NOTICE.txt
	cd mac/dist; zip -r focalboard-mac.zip Focalboard.app MIT-COMPILED-LICENSE.md NOTICE.txt webapp-NOTICE.txt

win-wpf-app: server-dll webapp
	cd win-wpf && ./build.bat
	cd win-wpf && ./package.bat
	cd win-wpf && ./package-zip.bat

linux-app: webapp
	rm -rf linux/temp
	rm -rf linux/dist
	mkdir -p linux/dist
	mkdir -p linux/temp/focalboard-app
	cp app-config.json linux/temp/focalboard-app/config.json
	cp build/MIT-COMPILED-LICENSE.md linux/temp/focalboard-app/
	cp NOTICE.txt linux/temp/focalboard-app/
	cp webapp/NOTICE.txt linux/temp/focalboard-app/webapp-NOTICE.txt
	cp -R webapp/pack linux/temp/focalboard-app/pack
	cd linux; make build
	cp -R linux/bin/focalboard-app linux/temp/focalboard-app/
	cd linux/temp; tar -zcf ../dist/focalboard-linux.tar.gz focalboard-app
	rm -rf linux/temp

swagger:
	mkdir -p server/swagger/docs
	mkdir -p server/swagger/clients
	cd server && swagger generate spec -m -o ./swagger/swagger.yml

	cd server/swagger && openapi-generator generate -i swagger.yml -g html2 -o docs/html
	cd server/swagger && openapi-generator generate -i swagger.yml -g go -o clients/go
	cd server/swagger && openapi-generator generate -i swagger.yml -g javascript -o clients/javascript
	cd server/swagger && openapi-generator generate -i swagger.yml -g typescript-fetch -o clients/typescript
	cd server/swagger && openapi-generator generate -i swagger.yml -g swift5 -o clients/swift
	cd server/swagger && openapi-generator generate -i swagger.yml -g python -o clients/python

clean:
	rm -rf bin
	rm -rf dist
	rm -rf webapp/pack
	rm -rf mac/temp
	rm -rf mac/dist
	rm -rf linux/dist
	rm -rf win-wpf/msix
	rm -f win-wpf/focalboard.msix

cleanall: clean
	rm -rf webapp/node_modules
