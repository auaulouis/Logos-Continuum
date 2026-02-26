/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable no-nested-ternary */
import { useEffect, useState } from 'react';
import { DateRangePicker, RangeKeyDict } from 'react-date-range';
import Multiselect from 'multiselect-react-dropdown';
import { motion } from 'framer-motion';
import styles from './styles.module.scss';
import {
  sideOptions, SideOption, divisionOptions, DivisionOption, yearOptions, YearOption, SchoolOption,
} from '../../lib/constants';

type FiltersProps = {
  selectionRange: {
    startDate: Date,
    endDate: Date,
    key: string,
  },
  handleSelect: (ranges: RangeKeyDict) => void,
  resetDate: () => void,
  resetSchools: () => void,
  onSideSelect: (selected: SideOption[]) => void,
  urlValues: {[key: string]: any},
  onDivisionSelect: (selected: DivisionOption[]) => void,
  onYearSelect: (selected: YearOption[]) => void,
  onSchoolSelect: (selected: SchoolOption[]) => void,
  schools: SchoolOption[],
  togglePersonal: () => void,
}

const Filters = ({
  selectionRange, handleSelect, resetDate, onSideSelect, urlValues, onDivisionSelect, onYearSelect, onSchoolSelect, schools, resetSchools, togglePersonal,
}: FiltersProps) => {
  const [isFiltersShown, setIsFiltersShown] = useState(false);

  /**
   * Toggle visibility of the calendar element programatically (since the package doesn't support this functionality natively).
   * On click handler tied to the start and end date inputs.
   */
  const toggleCalendar = (e?: MouseEvent, off?: boolean) => {
    const elements = document.getElementsByClassName('rdrMonthsVertical') as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < elements.length; i += 1) {
      elements[i].style.display = (elements[i].style.display !== 'none' || off) ? 'none' : 'block';
    }

    const elements2 = document.getElementsByClassName('rdrMonthAndYearWrapper') as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < elements2.length; i += 1) {
      elements2[i].style.display = (elements2[i].style.display !== 'none' || off) ? 'none' : 'flex';
    }

    const elements3 = document.getElementsByClassName('rdrCalendarWrapper') as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < elements3.length; i += 1) {
      elements3[i].style.background = (elements3[i].style.background === '' || off) ? 'transparent' : '';
    }
  };

  useEffect(() => {
    const elements = document.getElementsByClassName('rdrDateDisplayItem') as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < elements.length; i += 1) {
      elements[i].addEventListener('click', toggleCalendar);
    }

    const elements2 = document.getElementsByClassName('rdrDefinedRangesWrapper') as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < elements2.length; i += 1) {
      elements2[i].style.display = 'none';
    }

    const elements4 = document.getElementsByClassName('rdrDateRangeWrapper') as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < elements4.length; i += 1) {
      elements4[i].style.width = '100%';
    }

    return () => {
      const elements3 = document.getElementsByClassName('rdrDateDisplayItem') as HTMLCollectionOf<HTMLElement>;
      for (let i = 0; i < elements3.length; i += 1) {
        elements3[i].removeEventListener('click', toggleCalendar);
      }
    };
  }, [isFiltersShown]);

  useEffect(() => {
    toggleCalendar(undefined, true);
  }, []);

  const commonSelectStyle = {
    searchBox: {
      border: '1px solid rgba(145, 165, 214, 0.32)',
      borderRadius: '12px',
      minHeight: '36px',
      background: 'rgba(255,255,255,0.86)',
    },
    inputField: {
      width: 60,
      margin: 0,
      fontSize: 13,
      color: 'rgba(35,58,90,0.9)',
    },
    chips: {
      background: 'rgba(151, 178, 231, 0.95)',
      color: '#ffffff',
      borderRadius: '9px',
    },
    option: {
      color: 'rgba(35,58,90,0.9)',
      background: '#ffffff',
    },
    optionContainer: {
      border: '1px solid rgba(145, 165, 214, 0.25)',
      borderRadius: '10px',
      boxShadow: '0 8px 18px rgba(110, 129, 180, 0.18)',
    },
  };

  return (
    <div className={styles['filters-anchor']}>
      <div className={styles['filters-toolbar']}>
        <button type="button" className={styles['filter-prompt']} onClick={() => setIsFiltersShown((i) => !i)}>Filters</button>
      </div>
      <motion.div
        className={`${styles.filters} ${isFiltersShown ? styles['filters-open'] : styles['filters-collapsed']}`}
        animate={{ height: isFiltersShown ? 'auto' : 0, opacity: isFiltersShown ? 1 : 0 }}
        style={{ overflow: 'hidden', pointerEvents: isFiltersShown ? 'auto' : 'none' }}
      >
        <div className={styles.filter}>
          <h6>SIDE</h6>
          <Multiselect
            options={sideOptions}
            displayValue="name"
            selectedValues={urlValues.sides || [sideOptions[0], sideOptions[1]]}
            style={{ ...commonSelectStyle, multiselectContainer: { width: 200 } }}
            hidePlaceholder
            emptyRecordMsg=""
            placeholder=""
            onSelect={onSideSelect}
            onRemove={onSideSelect}
          />
        </div>
        <div className={styles.filter}>
          <h6>DIVISION</h6>
          <Multiselect
            options={divisionOptions}
            displayValue="name"
            selectedValues={urlValues.division || [divisionOptions[0], divisionOptions[1]]}
            style={{ ...commonSelectStyle, multiselectContainer: { width: 200 }, chips: { display: 'none' } }}
            hidePlaceholder
            emptyRecordMsg=""
            placeholder=""
            onSelect={onDivisionSelect}
            onRemove={onDivisionSelect}
            showCheckbox
            showArrow
          />
        </div>
        <div className={styles.filter}>
          <h6>YEAR</h6>
          <Multiselect
            options={yearOptions}
            displayValue="name"
            selectedValues={urlValues.year || [yearOptions[0], yearOptions[1]]}
            style={{ ...commonSelectStyle, multiselectContainer: { width: 100 }, chips: { display: 'none' } }}
            hidePlaceholder
            emptyRecordMsg=""
            placeholder=""
            onSelect={onYearSelect}
            onRemove={onYearSelect}
            showCheckbox
            showArrow
          />
        </div>
        <div className={styles.filter}>
          <div className={styles['filter-row']}>
            <h6>SCHOOLS</h6>
            <button type="button" onClick={resetSchools} className={styles.clear}>{urlValues.schools?.length === schools.length ? 'deselect all' : 'select all'}</button>
          </div>
          <Multiselect
            options={schools}
            displayValue="name"
            selectedValues={urlValues.schools || schools}
            style={{ ...commonSelectStyle, multiselectContainer: { width: 200 }, chips: { display: 'none' } }}
            hidePlaceholder
            emptyRecordMsg=""
            placeholder=""
            onSelect={onSchoolSelect}
            onRemove={onSchoolSelect}
            showCheckbox
            showArrow
          />
        </div>
        <div className={`${styles.filter} ${styles['range-container']}`}>
          <div className={styles['filter-row']}>
            <h6 className={styles.range}>DATE</h6>
            <button type="button" onClick={resetDate} className={styles.clear}>clear</button>
          </div>
          <DateRangePicker
            ranges={[selectionRange]}
            onChange={handleSelect}
            staticRanges={[]}
            inputRanges={[]}
            editableDateInputs
          />
        </div>
      </motion.div>
    </div>
  );
};

export default Filters;
