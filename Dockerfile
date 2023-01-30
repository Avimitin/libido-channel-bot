FROM denoland/deno:1.30.0

WORKDIR /app

USER deno

COPY bot.ts .
RUN deno cache bot.ts

CMD ["run", "--allow-env", "--allow-read", "--allow-net", "bot.ts"]
