import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';

export default class Logo extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      networkType: '以太坊',
    };
  }
  componentDidMount = () => {
    
  }
  render() {
    return (
      <div className="logo" style={{}}>
        <Link to="/" className="logo-text">
          {this.state.networkType}
        </Link>
      </div>
    );
  }
}
