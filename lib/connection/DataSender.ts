export class DataSender {
  // eslint-disable-next-line max-len
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
  constructor() {
  }

  // eslint-disable-next-line class-methods-use-this
  send(data: Buffer | string) {
    console.log('sending', data);
  }
}
