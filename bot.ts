// @deno-types="npm:@types/node-telegram-bot-api";
import TelegramBot from "npm:node-telegram-bot-api";

const token = Deno.env.get("BOT_API_TOKEN");
if (token === undefined) {
  console.log("No token was given");
  Deno.exit(1);
}

const channelId = Deno.env.get("BOT_CHANNEL");
if (channelId === undefined) {
  console.log("No token was given");
  Deno.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const blacklist = {
  twitter: ["t", "s"],
};

const pipeline = new Map([
  ["twitter.com", twitterUrlProcessor],
  ["exhentai.org", exhentaiUrlProcessor],
  ["e-hentai.org", exhentaiUrlProcessor],
]);

async function twitterUrlProcessor(url: URL, channel: string) {
  blacklist.twitter.forEach((q) => {
    url.searchParams.delete(q);
  });

  url.hostname = "fxtwitter.com";

  await bot.sendMessage(channel, url.toString());
}

interface EHentaiResp {
  gmetadata: {
    title_jpn: string;
    thumb: string;
    tags: string[];
    gid: number;
    token: string;
  }[];
}

async function exhentaiUrlProcessor(url: URL, channel: string) {
  const regexp = /\/g\/([^\/]+)\/([^\/]+)/;
  const match = url.pathname.match(regexp);
  if (match === null || match.length !== 3) {
    throw Error("No match found for this ehentai URL");
  }

  const resp = (await fetch("https://api.e-hentai.org/api.php", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: "gdata",
      gidlist: [[parseInt(match[1]), match[2]]],
      namespace: 1,
    }),
  }).then((resp) => resp.json())) as EHentaiResp;

  const gmetadata = resp.gmetadata[0];
  const caption = `
Title: ${gmetadata.title_jpn}
Artist: ${(() => {
    const artist =
      gmetadata.tags.find((element) => element.match("artist") !== null) ||
      "artist:Anoynmous";
    const base_url = new URL("https://e-hentai.org");
    base_url.searchParams.set("f_search", artist);
    return `<a href="${base_url.toString()}">${artist.split(":")[1]}</a>`;
  })()}
Tags: ${gmetadata.tags.map((val) => {
    const parts = val.split(":");
    const tag = parts[1].replaceAll(" ", "_");
    return `#${tag}`;
  })}
E-Hentai: https://e-hentai.org/${gmetadata.gid}/${gmetadata.token}
ExHentai: https://exhentai.org/${gmetadata.gid}/${gmetadata.token}
`;

  bot.sendPhoto(channel, gmetadata.thumb, {
    caption: caption,
    parse_mode: "HTML",
  });
}

bot.on("message", async (msg) => {
  if (msg.text === undefined) {
    return;
  }

  const entities = msg.entities;
  if (entities === undefined || entities.length === 0) {
    return;
  }

  for (const entity of entities) {
    if (entity.type !== "url") {
      continue;
    }
    const urlText = msg.text.slice(entity.offset, entity.length);
    const url = new URL(urlText);

    const processor = pipeline.get(url.hostname);
    if (processor === undefined) {
      continue;
    }

    await processor(url, channelId);
  }
});
