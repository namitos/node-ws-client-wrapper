const WebSocket = require('ws');
const EventEmitter = require('events');
const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

module.exports = class WSWrapper extends EventEmitter {
  /**
   * constructor
   */
  constructor(args) {
    super();
    Object.assign(this, args);
    setTimeout(() => {
      this.reinit({ text: 'start init' });
    }, 1000);
  }

  get url() {
    return '';
  }

  get reinitTimeout() {
    return 2000;
  }

  ping() {
    this.send({ type: 'ping', time: Date.now() });
  }

  get pingIntervalTime() {
    return 1000 * 60;
  }

  /**
   * initial ws method
   * @param {Object} reason message
   * @returns {null} null
   */
  async reinit(reason) {
    try {
      delete this.lastMessage;
      if (!this.url) {
        this.emit('error', { type: 'WSWrapperError', text: 'this.url required' });
        return;
      }

      this.emit('reinit-started', reason);
      // console.log('reinit', reason);

      try {
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.terminate();
        }
      } catch (err) {}
      let wsOptions = Object.assign({ rejectUnauthorized: false }, this.options || {});
      if (this.customSocketUrl) {
        let { connectionData, socketUrl } = await this.customSocketUrl();
        Object.assign(this, { connectionData });
        this.socket = new WebSocket(socketUrl, wsOptions);
      } else {
        this.socket = new WebSocket(this.url, wsOptions);
      }
      this.socket.on('open', this.handleOpen.bind(this));
      this.socket.on('message', this._handleMessage.bind(this));
      this.socket.on('error', this.handleError.bind(this));
      this.socket.on('close', this.handleClose.bind(this));
      if (this._pingInterval) {
        clearInterval(this._pingInterval);
      }
      this._pingInterval = setInterval(() => {
        try {
          this.ping();
        } catch (err) {
          this.emit('error', { type: 'WSWrapperError', err });
        }
      }, this.pingIntervalTime);

      if (this._aliveInterval) {
        clearInterval(this._aliveInterval);
      }
      this._aliveInterval = setInterval(() => {
        //reinit if last message was taken too long
        if (this.lastMessage && Date.now() - this.lastMessage > this.pingIntervalTime) {
          this.reinit({ type: 'WSWrapperError', text: 'reinit inactive ws' });
        }
      }, 1000);
    } catch (err) {
      // console.log('catch', err);
      this.emit('error', { type: 'WSWrapperError', err });
    }
  }

  /**
   * @param {Error} err err
   * @returns {null} null
   */
  async handleError(err) {
    let reason = { type: 'WSWrapperError', text: 'socket handleError', err };
    this.emit('error', reason);
    // console.log('socket handleError', err);
    await wait(this.reinitTimeout);
    await this.reinit(reason);
  }

  /**
   * @returns {null} null
   */
  async handleClose() {
    await this.handleError({ text: 'socket closed' });
  }

  /**
   * @param {Object} message message
   * @returns {null} null
   */
  handleMessage(message) {
    console.log('dummy handleMessage', message);
  }

  _handleMessage(message) {
    this.lastMessage = Date.now();
    if (typeof message === 'string') {
      message = JSON.parse(message);
    }
    this.handleMessage(message);
  }

  send(message) {
    try {
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      this.emit('error', { type: 'WSWrapperError', err });
    }
  }
};
