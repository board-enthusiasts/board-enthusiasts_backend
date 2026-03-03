FROM postgres:16

COPY docker-entrypoint-ssl.sh /usr/local/bin/docker-entrypoint-ssl.sh

RUN chmod +x /usr/local/bin/docker-entrypoint-ssl.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-ssl.sh"]
CMD ["postgres"]
