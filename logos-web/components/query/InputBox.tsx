import styles from './styles.module.scss';

type InputBoxProps = {
  onChange: (value: string) => void;
  value: string;
  onSearch: () => void;
  loading: boolean;
  rightAction?: React.ReactNode;
};

const InputBox = ({
  value, onChange, onSearch, loading, rightAction,
}: InputBoxProps) => {
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className={styles['input-container']}>
      <div className={styles['query-controls-row']}>
        <input
          type="text"
          placeholder="Search (use cite:source for citation matching)"
          className={styles.search}
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          onKeyDown={onKeyDown}
        />
        <button className={styles.button} type="button" onClick={onSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
        {rightAction}
      </div>
    </div>
  );
};

export default InputBox;
