import React from 'react';

/**
 * 主界面（Popover）最小骨架：顶部栏 + 空状态占位。
 * 更多状态模块在 T2 中完善。
 */
const App: React.FC = () => {
  return (
    <div className="popup">
      <header className="popup__header">
        <span className="popup__title">网页翻译助手</span>
      </header>
      <main className="popup__body">
        <p className="popup__empty">尚未开始翻译</p>
      </main>
    </div>
  );
};

export default App;