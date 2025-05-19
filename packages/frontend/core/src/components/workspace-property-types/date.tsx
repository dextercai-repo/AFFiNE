import { DatePicker, Menu, PropertyValue } from '@affine/component';
import type { FilterParams } from '@affine/core/modules/collection-rules';
import { i18nTime, useI18n } from '@affine/i18n';
import { DateTimeIcon } from '@blocksuite/icons/rc';
import { cssVarV2 } from '@toeverything/theme/v2';
import { useCallback } from 'react';

import { PlainTextDocGroupHeader } from '../explorer/docs-view/group-header';
import { StackProperty } from '../explorer/docs-view/stack-property';
import type { DocListPropertyProps, GroupHeaderProps } from '../explorer/types';
import type { PropertyValueProps } from '../properties/types';
import * as styles from './date.css';

const useParsedDate = (value: string) => {
  const parsedValue =
    typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)
      ? value
      : undefined;
  const displayValue = parsedValue
    ? i18nTime(parsedValue, { absolute: { accuracy: 'day' } })
    : undefined;
  const t = useI18n();
  return {
    parsedValue,
    displayValue:
      displayValue ??
      t['com.affine.page-properties.property-value-placeholder'](),
  };
};

export const DateValue = ({
  value,
  onChange,
  readonly,
}: PropertyValueProps) => {
  const { parsedValue, displayValue } = useParsedDate(value);

  if (readonly) {
    return (
      <PropertyValue
        className={parsedValue ? '' : styles.empty}
        isEmpty={!parsedValue}
        readonly
      >
        {displayValue}
      </PropertyValue>
    );
  }

  return (
    <Menu
      contentOptions={{
        style: BUILD_CONFIG.isMobileEdition ? { padding: '15px 20px' } : {},
      }}
      items={<DatePicker value={parsedValue} onChange={onChange} />}
    >
      <PropertyValue
        className={parsedValue ? '' : styles.empty}
        isEmpty={!parsedValue}
      >
        {displayValue}
      </PropertyValue>
    </Menu>
  );
};

export const DateFilterValue = ({
  filter,
  onChange,
}: {
  filter: FilterParams;
  onChange: (filter: FilterParams) => void;
}) => {
  const t = useI18n();
  const value = filter.value;
  const values = value?.split(',') ?? [];
  const displayDates =
    values.map(t => i18nTime(t, { absolute: { accuracy: 'day' } })) ?? [];

  const handleChange = useCallback(
    (date: string) => {
      onChange({
        ...filter,
        value: date,
      });
    },
    [onChange, filter]
  );

  return filter.method === 'after' || filter.method === 'before' ? (
    <Menu
      items={
        <DatePicker value={values[0] || undefined} onChange={handleChange} />
      }
    >
      {displayDates[0] ? (
        <span>{displayDates[0]}</span>
      ) : (
        <span style={{ color: cssVarV2('text/placeholder') }}>
          {t['com.affine.filter.empty']()}
        </span>
      )}
    </Menu>
  ) : filter.method === 'between' ? (
    <>
      <Menu
        items={
          <DatePicker
            value={values[0] || undefined}
            onChange={value => handleChange(`${value},${values[1] || ''}`)}
          />
        }
      >
        {displayDates[0] ? (
          <span>{displayDates[0]}</span>
        ) : (
          <span style={{ color: cssVarV2('text/placeholder') }}>
            {t['com.affine.filter.empty']()}
          </span>
        )}
      </Menu>
      <span style={{ color: cssVarV2('text/placeholder') }}>&nbsp;-&nbsp;</span>
      <Menu
        items={
          <DatePicker
            value={values[1] || undefined}
            onChange={value => handleChange(`${values[0] || ''},${value}`)}
          />
        }
      >
        {displayDates[1] ? (
          <span>{displayDates[1]}</span>
        ) : (
          <span style={{ color: cssVarV2('text/placeholder') }}>
            {t['com.affine.filter.empty']()}
          </span>
        )}
      </Menu>
    </>
  ) : undefined;
};

export const DateDocListProperty = ({ value }: DocListPropertyProps) => {
  if (!value) return null;

  return (
    <StackProperty icon={<DateTimeIcon />}>
      {i18nTime(value, { absolute: { accuracy: 'day' } })}
    </StackProperty>
  );
};

export const DateGroupHeader = ({ groupId, docCount }: GroupHeaderProps) => {
  const date = groupId || 'No Date';

  return (
    <PlainTextDocGroupHeader groupId={groupId} docCount={docCount}>
      {date}
    </PlainTextDocGroupHeader>
  );
};
