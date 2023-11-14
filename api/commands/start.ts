
import { constructZupassPcdGetRequestUrl } from "@pcd/passport-interface";
import {
  EdDSATicketFieldsToReveal,
  ZKEdDSAEventTicketPCDArgs,
  ZKEdDSAEventTicketPCDPackage,
} from "@pcd/zk-eddsa-event-ticket-pcd";
import { EdDSATicketPCDPackage } from "@pcd/eddsa-ticket-pcd";
import { Menu, MenuRange } from "@grammyjs/menu";
import { ArgumentTypeName } from "@pcd/pcd-types";
import { SemaphoreIdentityPCDPackage } from "@pcd/semaphore-identity-pcd";

export function zupass_menu () { 
  // Initialize zupass menu
  const menu = new Menu("zupass");

  // Define EdDSA fields that will be exposed
  const fieldsToReveal: EdDSATicketFieldsToReveal = {
    revealTicketId: false,
    revealEventId: false,
    revealProductId: false,
    revealTimestampConsumed: false,
    revealTimestampSigned: false,
    revealAttendeeSemaphoreId: true,
    revealIsConsumed: false,
    revealIsRevoked: false,
  };

  // Define ZK edDSA PCD arguments
  const args: ZKEdDSAEventTicketPCDArgs = {
    ticket: {
      argumentType: ArgumentTypeName.PCD,
      pcdType: EdDSATicketPCDPackage.name,
      value: undefined,
      userProvided: true,
      displayName: "Your Ticket",
      description: "",
      validatorParams: {
        eventIds: [],
        productIds: [],
        // TODO: surface which event ticket we are looking for
        notFoundMessage: "You don't have a ticket to this event.",
      },
      hideIcon: true,
    },
    identity: {
      argumentType: ArgumentTypeName.PCD,
      pcdType: SemaphoreIdentityPCDPackage.name,
      value: undefined,
      userProvided: true,
    },
    fieldsToReveal: {
      argumentType: ArgumentTypeName.ToggleList,
      value: fieldsToReveal,
      userProvided: false,
      hideIcon: true,
    },
    externalNullifier: {
      argumentType: ArgumentTypeName.BigInt,
      value: undefined,
      userProvided: false,
    },
    validEventIds: {
      argumentType: ArgumentTypeName.StringArray,
      value: ["b03bca82-2d63-11ee-9929-0e084c48e15f"],
      userProvided: false,
    },
    watermark: {
      argumentType: ArgumentTypeName.BigInt,
      value: Date.now().toString(),
      userProvided: false,
      description: `This encodes the current timestamp so that the proof can grant funds via faucet when appropriate.`,
    },
  };

  // Set menu variables
  menu.dynamic(async (ctx) => {
    const range = new MenuRange();
    // const appUrl = `${process.env.VERCEL_URL}`;
    const appUrl = "https://zupass.org";
    const returnHost =
      process.env.NODE_ENV == "development"
        ? `https://06c4-2603-8080-d9f0-79b0-298c-f4a7-f8f-6412.ngrok.io`
        : `https://${process.env.VERCEL_URL}`;
    const returnUrl = `${returnHost}/api/zucheck/?username=${ctx.from?.username}&telegram_chat_id=${ctx.chat?.id}`;
    console.log("returnUrl: ", returnUrl);
    let proofUrl = await constructZupassPcdGetRequestUrl(
      appUrl,
      returnUrl,
      ZKEdDSAEventTicketPCDPackage.name,
      args,
      {
        genericProveScreen: true,
        title: "",
        description:
          "Fruitbot requests a zero-knowledge proof of your ticket to trade fruit",
      }
    );
    console.log("zupass url: ", proofUrl);
    range.webApp("Validate proof", proofUrl);
    return range;
  });

  return menu;
}

export function handle_zuconnect(ctx, bot, menu) { 
  // Send the menu.
  if (ctx.from?.id) {
    ctx.reply("Validate your proof and then use the menu to play:", {
      reply_markup: menu,
    });
    // TODO: Figure out why this doesn't work
    // await bot.api.sendMessage(
    //   ctx.chat?.id,
    //   "Validate your proof and then use the menu to play:",
    //   { reply_markup: menu }
    // );
  }
  //await zupass();
}