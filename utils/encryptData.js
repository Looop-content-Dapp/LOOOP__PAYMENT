const CryptoJS = require("crypto-js");

const encryptData = (data) => {
  const key = CryptoJS.enc.Utf8.parse(process.env.FLW_ENCRYPTION_KEY); // Use env variable
  const iv = CryptoJS.enc.Utf8.parse("12345678"); // 8-byte IV
  const encrypted = CryptoJS.TripleDES.encrypt(JSON.stringify(data), key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  console.log("Encrypted data:", encrypted.toString());
  return encrypted.toString();
};

export {
    encryptData
}
