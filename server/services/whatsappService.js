// const axios = require("axios");

// async function sendWhatsAppMessage(to, hatchDate, area, phone) {
//   const url =
//     "http://smsbox.starsmsindia.com/rest/services/sendSMS/v2/sendtemplate?AUTH_KEY=a2d94dc27898ced435ce96a9ecd2a5f0";

//   const body = {
//     messaging_product: "whatsapp",
//     to: to,
//     type: "template",
//     template: {
//       name: "layerchicksnew",
//       language: { code: "en" },
//       components: [
//         {
//           type: "body",
//           parameters: [
//             { type: "text", text: hatchDate },
//             { type: "text", text: area },
//             { type: "text", text: "919202215312" },
//           ],
//         },
//       ],
//     },
//   };

//   // const body = {
//   //   mobileNumbers: to,
//   //   senderId: "919893307656", // your approved WhatsApp sender ID
//   //   component: {
//   //     messaging_product: "whatsapp",
//   //     recipient_type: "individual",
//   //     type: "template",
//   //     template: {
//   //       name: "layerchicks",
//   //       language: { code: "en" },
//   //       components: [
//   //         {
//   //           type: "body",
//   //           index: 0,
//   //           parameters: [
//   //             { type: "text", text: hatchDate }, // param 1
//   //             { type: "text", text: area }, // param 2
//   //             { type: "text", text: phone }, // param 3
//   //           ],
//   //         },
//   //       ],
//   //     },
//   //     qrImageUrl: false,
//   //     qrLinkUrl: false,
//   //     to: to,
//   //   },
//   // };

//   try {
//     const response = await axios.post(url, body, {
//       headers: { "Content-Type": "application/json" },
//     });

//     console.log("Message sent successfully →", to);
//     console.log(response.data);
//     return response.data;
//   } catch (err) {
//     console.error("WhatsApp Sending Error:", err.response?.data || err);
//     throw err;
//   }
// }

// module.exports = { sendWhatsAppMessage };
