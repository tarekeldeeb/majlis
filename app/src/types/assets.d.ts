declare module '*.mp3' {
  const asset: number | string;
  export default asset;
}

declare module '*.jpg' {
  const asset: number;
  export default asset;
}
