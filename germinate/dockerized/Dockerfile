FROM continuumio/miniconda3

RUN conda install -c conda-forge --repodata-fn=repodata.json deap nodejs && \
    conda install -c potassco clingo

COPY dockerized/run-server.sh /run-server.sh
COPY Gemini /Gemini
COPY Germinate /Germinate

RUN cd /Gemini/server; npm install; \
    chmod +x /run-server.sh
EXPOSE 4040

ENTRYPOINT ["/bin/sh", "/run-server.sh"]
