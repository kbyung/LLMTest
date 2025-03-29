import React from 'react';

function Test() {
  return (
    <div style={styles.container}>
      <h1>Hello, World!</h1>
      <p>This is a basic React component.</p>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif',
  },
};

export default Test;
