"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/index.ts
var src_exports = {};
__export(src_exports, {
  RSAPCDTypeName: () => RSAPCDTypeName,
  RSATicketPCD: () => RSATicketPCD2,
  RSATicketPCDPackage: () => RSATicketPCDPackage,
  deserialize: () => deserialize,
  getDisplayOptions: () => getDisplayOptions,
  getPublicKey: () => getPublicKey,
  getQRCodeColorOverride: () => getQRCodeColorOverride,
  getTicketData: () => getTicketData,
  initArgs: () => initArgs,
  prove: () => prove,
  serialize: () => serialize,
  verify: () => verify
});
module.exports = __toCommonJS(src_exports);

// src/RSATicketPCD.ts
var import_rsa_pcd = require("@pcd/rsa-pcd");
var import_json_bigint = __toESM(require("json-bigint"));
var import_uuid = require("uuid");

// src/CardBody.tsx
var import_passport_ui = require("@pcd/passport-ui");
var import_react = require("react");
var import_styled_components = __toESM(require("styled-components"));

// src/utils.ts
var import_node_rsa = __toESM(require("node-rsa"));
function getTicketData(pcd) {
  var _a, _b, _c, _d;
  let ticketData = {};
  try {
    ticketData = JSON.parse(
      (_d = (_c = (_b = (_a = pcd == null ? void 0 : pcd.proof) == null ? void 0 : _a.rsaPCD) == null ? void 0 : _b.claim) == null ? void 0 : _c.message) != null ? _d : "{}"
    );
  } catch (e) {
  }
  return ticketData;
}
function getPublicKey(pcd) {
  var _a, _b, _c;
  const encodedPublicKey = (_c = (_b = (_a = pcd == null ? void 0 : pcd.proof) == null ? void 0 : _a.rsaPCD) == null ? void 0 : _b.proof) == null ? void 0 : _c.publicKey;
  if (!encodedPublicKey) {
    return void 0;
  }
  try {
    const key = new import_node_rsa.default(encodedPublicKey, "public");
    return key;
  } catch (e) {
    console.log("failed to deserialize key");
  }
  return void 0;
}
var INVALID_TICKET_QR_CODE_COLOR = "#d3d3d3";
function getQRCodeColorOverride(pcd) {
  const ticketData = getTicketData(pcd);
  if (ticketData.isConsumed || ticketData.isRevoked) {
    return INVALID_TICKET_QR_CODE_COLOR;
  }
  return void 0;
}

// src/CardBody.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function RSATicketCardBody({ pcd }) {
  const ticketData = getTicketData(pcd);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Container, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TicketQR, { pcd }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TicketInfo, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: ticketData.attendeeName }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: ticketData.attendeeEmail })
    ] })
  ] });
}
function TicketQR({ pcd }) {
  const generate = (0, import_react.useCallback)(() => __async(this, null, function* () {
    console.log(`[QR] generating proof, timestamp ${Date.now()}`);
    const serialized = yield RSATicketPCDPackage.serialize(pcd);
    const serializedPCD = JSON.stringify(serialized);
    console.log(`[QR] generated proof, length ${serializedPCD.length}`);
    const encodedPCD = (0, import_passport_ui.encodeQRPayload)(serializedPCD);
    if (!initArgs.makeEncodedVerifyLink) {
      throw new Error("must provide makeEncodedVerifyLink");
    }
    const verificationLink = initArgs.makeEncodedVerifyLink(encodedPCD);
    return verificationLink;
  }), [pcd]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_passport_ui.QRDisplayWithRegenerateAndStorage,
    {
      generateQRPayload: generate,
      maxAgeMs: 1e3 * 60,
      uniqueId: pcd.id,
      fgColor: getQRCodeColorOverride(pcd)
    }
  );
}
var Container = import_styled_components.default.span`
  padding: 16px;
  overflow: hidden;
  width: 100%;
`;
var TicketInfo = import_styled_components.default.div`
  margin-top: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

// src/RSATicketPCD.ts
var RSAPCDTypeName = "rsa-ticket-pcd";
var initArgs;
function init(args) {
  return __async(this, null, function* () {
    initArgs = args;
  });
}
var RSATicketPCD2 = class {
  constructor(id, claim, proof) {
    this.type = RSAPCDTypeName;
    this.id = id;
    this.claim = claim;
    this.proof = proof;
  }
};
function prove(args) {
  return __async(this, null, function* () {
    var _a, _b, _c;
    if (!initArgs) {
      throw new Error("package not initialized");
    }
    if (!((_a = args.rsaPCD.value) == null ? void 0 : _a.pcd)) {
      throw new Error("missing rsa pcd");
    }
    const deserialized = yield import_rsa_pcd.RSAPCDPackage.deserialize((_b = args.rsaPCD.value) == null ? void 0 : _b.pcd);
    const valid = yield import_rsa_pcd.RSAPCDPackage.verify(deserialized);
    if (!valid) {
      throw new Error("supplied rsa pcd is not valid");
    }
    const id = (_c = args.id.value) != null ? _c : (0, import_uuid.v4)();
    return new RSATicketPCD2(id, {}, { rsaPCD: deserialized });
  });
}
function verify(pcd) {
  return __async(this, null, function* () {
    if (!initArgs) {
      throw new Error("package not initialized");
    }
    try {
      const valid = yield import_rsa_pcd.RSAPCDPackage.verify(pcd.proof.rsaPCD);
      return valid;
    } catch (e) {
      return false;
    }
  });
}
function serialize(pcd) {
  return __async(this, null, function* () {
    if (!initArgs) {
      throw new Error("package not initialized");
    }
    const serializedRSAPCD = yield import_rsa_pcd.RSAPCDPackage.serialize(pcd.proof.rsaPCD);
    return {
      type: RSAPCDTypeName,
      pcd: (0, import_json_bigint.default)().stringify({
        id: pcd.id,
        rsaPCD: serializedRSAPCD
      })
    };
  });
}
function deserialize(serialized) {
  return __async(this, null, function* () {
    if (!initArgs) {
      throw new Error("package not initialized");
    }
    const deserializedWrapper = (0, import_json_bigint.default)().parse(serialized);
    const deserializedRSAPCD = yield import_rsa_pcd.RSAPCDPackage.deserialize(
      deserializedWrapper.rsaPCD.pcd
    );
    return new RSATicketPCD2(
      deserializedWrapper.id,
      {},
      { rsaPCD: deserializedRSAPCD }
    );
  });
}
function getDisplayOptions(pcd) {
  if (!initArgs) {
    throw new Error("package not initialized");
  }
  const ticketData = getTicketData(pcd);
  let header = "Ticket";
  if (ticketData.isRevoked) {
    header = `[CANCELED] ${ticketData.eventName} (${ticketData.ticketName})`;
  } else if (ticketData.isConsumed) {
    header = `[SCANNED] ${ticketData.eventName} (${ticketData.ticketName})`;
  } else if (ticketData.eventName && ticketData.ticketName) {
    header = `${ticketData.eventName} (${ticketData.ticketName})`;
  }
  return {
    header,
    displayName: "ticket-" + pcd.id.substring(0, 4)
  };
}
var RSATicketPCDPackage = {
  name: RSAPCDTypeName,
  renderCardBody: RSATicketCardBody,
  getDisplayOptions,
  init,
  prove,
  verify,
  serialize,
  deserialize
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RSAPCDTypeName,
  RSATicketPCD,
  RSATicketPCDPackage,
  deserialize,
  getDisplayOptions,
  getPublicKey,
  getQRCodeColorOverride,
  getTicketData,
  initArgs,
  prove,
  serialize,
  verify
});
