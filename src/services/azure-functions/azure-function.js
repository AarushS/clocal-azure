"use strict";

const CloudLocal = require("./../azure/cloud-local");
const Docker = require("dockerode");

let docker = new Docker({
  socketPath: "/var/run/docker.sock"
});

class AzureFunction extends CloudLocal {
  start() {
    docker.createContainer(
      {
        Image: "microsoft/azure-functions-runtime:v2.0.0-beta1",
        // name: 'clocal-azure-function',
        Tty: true,
        Cmd: ["/bin/sh"],
        ExposedPorts: { "80/tcp": {} },
        PortBindings: {
          "80/tcp": [{ HostPort: "9574" }]
        }
      },
      function(err, container) {
        if (err) {
          console.log(err);
          return;
        }
        container.start({}, function(err, data) {
          if (err) {
            console.log(err);
            return;
          }
          runExec(container);
        });
      }
    );
  }
}

function runExec(container) {
  let options = {
    Cmd: ["sh", "-c", "cp /grpc/libs/opt/libgrpc_csharp_ext.so.1.12.1 /output"],
    AttachStdout: true,
    AttachStderr: true
  };

  container.exec(options, function(err, exec) {
    if (err) {
      console.log(err);
      return;
    }
    exec.start(function(err, stream) {
      if (err) {
        console.log(err);
        return;
      }
      if (process.argv[2] == "function-start") {
        container.modem.demuxStream(stream, process.stdout, process.stderr);
        customTerminal(container);
      }
    });
  });
}


function customTerminal(container) {
  setTimeout(function() {
    console.log("$ Clocal >");
    let stdin = process.openStdin();
    stdin.addListener("data", function(d) {
      if (d.toString().trim() == "clocal function-stop") {
        removeContainer();
        setTimeout(function() {
          console.log("Functions container stopped");
          return process.exit(0);
        }, 5000);
      } else {
        console.log("Invalid Command");
      }
    });
  }, 4000);
}

function removeContainer() {
  docker.listContainers(function(err, containers) {
    containers.forEach(function(containerInfo) {
      docker.getContainer(containerInfo.Id).kill(containerInfo.Id);
    });
  });
}

module.exports = AzureFunction;