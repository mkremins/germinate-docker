# germinate-docker

A Dockerized version of the [Germinate](https://github.com/ExpressiveIntelligence/Germinate) game design tool and the [Gemini](https://github.com/ExpressiveIntelligence/Gemini) game generator on which it depends, for easier installation by researchers and other prospective users. Initially created by [Joe Osborn](https://research.pomona.edu/jcosborn) and lightly tweaked by [Max Kreminski](https://mkremins.github.io).

## Running Germinate via Docker

First, [install Docker](https://www.docker.com) on your machine. Then clone this repository and `cd` into the clone:

```sh
git clone git@github.com:mkremins/germinate-docker.git
cd germinate-docker
```

Next, run the following commands to build the Docker container:

```sh
cd germinate/dockerized
DOCKER_BUILDKIT=1 docker build -f Dockerfile -t germinate:latest ..
cd ../..
```

Once the container is built, run it with the following command:

```sh
docker run -it -p 9000:9000 -p 3000:3000 germinate:latest
```

Now go to `localhost:9000` in your web browser to access the Germinate user interface. From here, everything should behave the same as described in the "Running Germinate" and later sections of [these instructions](https://github.com/ExpressiveIntelligence/Germinate/releases/tag/aiide-20).

## Future plans

Right now, this repository duplicates the contents of the main [ExpressiveIntelligence/Gemini](https://github.com/ExpressiveIntelligence/Gemini) and [ExpressiveIntelligence/Germinate](https://github.com/ExpressiveIntelligence/Germinate) repos in the `germinate/{Gemini,Germinate}` directories respectively. These local copies of Gemini and Germinate may become stale if development continues in the upstream repos. In the future, we should probably replace the local copies of Gemini and Germinate in this repo with a build script that pulls down the contents of the upstream repos and bundles them up as a container in a single pass.

## Original instructions

Copied from an email by Joe Osborn:

> Here's a quick dockerfile and run script for gemini, so you can reduce the instructions to `docker run -it -p 4040:4040 gemini:latest`
>
> I put them into a folder hierarchy like so:
>
>```
>gemini/
>  Gemini/
>  GeminiTool/
>  dockerized/
>    Dockerfile
>    run-server.sh
>```
>
> And I built a container using this command from the `dockerized` directory:
>
>```
>DOCKER_BUILDKIT=1 docker build -f Dockerfile -t gemini:latest ..
>```
>
> Now I can run it all with one `docker run` command.  Not too bad and much easier to share around, since you can put it on dockerhub if you want and then tell people to grab it from there (eis/gemini:latest or something).  Or use SOE's gitlab instance as a docker repo if you want.

And a followup email after testing revealed a "broken pipe" error:

> I looked into it and suspected that port 3000 or whatever needs to be exposed with `-p` as well as 4040.  I tried that but the web page couldn’t open the web socket, so I thought the issue could be that the socket server should listen on 0.0.0.0 and not “localhost”.  I made that change and things started working 👍
>
> So to sum up, add `-p 3000:3000` to the command line and tweak index.js to bind to `0.0.0.0`. And it works!

Several small setup details have changed since these emails were written. In particular:

* The top-level folder in this repo was renamed from `gemini` to `germinate`
* The Docker container was renamed from `gemini` to `germinate`
* The `GeminiTool` directory was renamed to `Germinate`
* Port `4040` was changed to `9000` for consistency with non-Docker Germinate setup instructions

Additionally, Joe's original Dockerfile didn't pass the `--repodata-fn=repodata.json` argument to the `conda install -c conda-forge` command. Max added this argument to build a container with a modern (post-6.x.x) version of Node (as required to run chokidar, and as suggested by [this StackOverflow thread](https://stackoverflow.com/questions/62325068/cannot-install-latest-nodejs-using-conda-on-mac)), but doesn't totally understand its implications.
