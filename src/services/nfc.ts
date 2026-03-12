import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Card } from './db';

const generateVCard = (card: Card) => {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${card.name}`,
    `ORG:${card.company}`,
    `TEL;TYPE=WORK,VOICE:${card.phone}`,
    `ADR;TYPE=WORK:;;${card.address}`,
    'END:VCARD',
  ].join('\n');
};

export const startNfcService = async () => {
  try {
    await NfcManager.start();
    return true;
  } catch (error) {
    console.warn('NFC start error:', error);
    return false;
  }
};

export const shareCardViaNfc = async (card: Card) => {
  const vCard = generateVCard(card);
  const bytes = Ndef.encodeMessage([Ndef.textRecord(vCard)]);

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    console.log('NFC Write Success');
    return true;
  } catch (ex) {
    console.warn('NFC Write Error:', ex);
    return false;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
};
