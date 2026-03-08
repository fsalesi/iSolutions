import { csMessages } from "./messages/cs";
import { deMessages } from "./messages/de";
import { enUkMessages } from "./messages/en-uk";
import { enUsMessages } from "./messages/en-us";
import { esMessages } from "./messages/es";
import { frMessages } from "./messages/fr";
import { heMessages } from "./messages/he";
import { itItMessages } from "./messages/it-it";
import { jaMessages } from "./messages/ja";
import { koMessages } from "./messages/ko";
import { nlMessages } from "./messages/nl";
import { plMessages } from "./messages/pl";
import { ptMessages } from "./messages/pt";
import { ruMessages } from "./messages/ru";
import { zhCnMessages } from "./messages/zh-cn";
import { zhTwMessages } from "./messages/zh-tw";
import type { TranslationBundle } from "./types";

const catalogs: Record<string, TranslationBundle> = {
  "cs": csMessages,
  "de": deMessages,
  "en-uk": enUkMessages,
  "en-us": enUsMessages,
  "es": esMessages,
  "fr": frMessages,
  "he": heMessages,
  "it-it": itItMessages,
  "ja": jaMessages,
  "ko": koMessages,
  "nl": nlMessages,
  "pl": plMessages,
  "pt": ptMessages,
  "ru": ruMessages,
  "zh-cn": zhCnMessages,
  "zh-tw": zhTwMessages,
};

export function getBaseCatalog(locale: string): TranslationBundle {
  const normalized = locale.toLowerCase();
  return catalogs[normalized]
    ?? catalogs[normalized.split("-")[0]]
    ?? {};
}

export function getDefaultCatalog(): TranslationBundle {
  return enUsMessages;
}
