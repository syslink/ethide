import React, { Component } from 'react';
import KeystoreManager from '../KeystoreManager';

export default class AccountManager extends Component {
  static displayName = 'AccountManager';

  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div className="accountmanager-page">
        <KeystoreManager />
      </div>
    );
  }
}
