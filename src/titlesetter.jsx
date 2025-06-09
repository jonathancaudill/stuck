import React from 'react';
import PropTypes from 'prop-types';

const TitleSetter = ({ title }) => {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const titleColor = isDarkMode ? 'lightgray' : '#666666';

  return (
    <div
      className="decorum-titlebar"
      data-tauri-drag-region
      style={{
        position: 'absolute',
        top: 2,
        left: 0,
        right: 0,
        height: '18px',
        lineHeight: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <span
        style={{
          pointerEvents: 'auto',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '70%',
          color: titleColor,
          fontFamily: 'menlo',
          fontSize: '12px',
        }}
      >
        {title || '[Untitled]'}
      </span>
    </div>
  );
};

TitleSetter.propTypes = {
  title: PropTypes.string,
};

TitleSetter.defaultProps = {
  title: '',
};

export default TitleSetter;
