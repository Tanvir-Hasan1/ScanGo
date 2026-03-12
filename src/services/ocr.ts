import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface TextBlock {
  text: string;
  frame?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export const recognizeText = async (imagePath: string): Promise<TextBlock[]> => {
  try {
    const result = await TextRecognition.recognize(imagePath);
    const blocks: TextBlock[] = [];

    result.blocks.forEach(block => {
      blocks.push({
        text: block.text,
        frame: block.frame,
      });
    });

    return blocks;
  } catch (error) {
    console.error('OCR Error:', error);
    return [];
  }
};
