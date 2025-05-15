import { Button, Divider } from '@affine/component';
import {
  WorkspacePropertyService,
  type WorkspacePropertyType,
} from '@affine/core/modules/workspace-property';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { WorkspacePropertyName } from '../../properties';
import { WorkspacePropertyTypes } from '../../workspace-property-types';
import type { ExplorerDisplayPreference } from '../types';
import * as styles from './properties.css';

export const filterDisplayProperties = <
  T extends { type: WorkspacePropertyType },
>(
  propertyList: T[],
  showInDocList: 'inline' | 'stack'
) => {
  return propertyList
    .filter(
      property =>
        WorkspacePropertyTypes[property.type].showInDocList === showInDocList
    )
    .map(property => ({
      property,
      config: WorkspacePropertyTypes[property.type],
    }));
};

export const DisplayProperties = ({
  displayPreference,
  onDisplayPreferenceChange,
}: {
  displayPreference: ExplorerDisplayPreference;
  onDisplayPreferenceChange: (
    displayPreference: ExplorerDisplayPreference
  ) => void;
}) => {
  const t = useI18n();
  const workspacePropertyService = useService(WorkspacePropertyService);
  const propertyList = useLiveData(workspacePropertyService.properties$);

  const displayProperties = displayPreference.displayProperties;
  const showIcon = displayPreference.showDocIcon ?? false;
  const showBody = displayPreference.showDocPreview ?? false;

  const propertiesGroups = useMemo(
    () => [
      {
        type: 'inline',
        properties: filterDisplayProperties(propertyList, 'inline'),
      },
      {
        type: 'stack',
        properties: filterDisplayProperties(propertyList, 'stack'),
      },
    ],
    [propertyList]
  );

  const handleDisplayPropertiesChange = useCallback(
    (displayProperties: string[]) => {
      onDisplayPreferenceChange({ ...displayPreference, displayProperties });
    },
    [displayPreference, onDisplayPreferenceChange]
  );

  const handlePropertyClick = useCallback(
    (propertyId: string) => {
      handleDisplayPropertiesChange(
        displayProperties && displayProperties.includes(propertyId)
          ? displayProperties.filter(id => id !== propertyId)
          : [...(displayProperties || []), propertyId]
      );
    },
    [displayProperties, handleDisplayPropertiesChange]
  );

  const toggleIcon = useCallback(() => {
    onDisplayPreferenceChange({
      ...displayPreference,
      showDocIcon: !showIcon,
    });
  }, [displayPreference, onDisplayPreferenceChange, showIcon]);

  const toggleBody = useCallback(() => {
    onDisplayPreferenceChange({
      ...displayPreference,
      showDocPreview: !showBody,
    });
  }, [displayPreference, onDisplayPreferenceChange, showBody]);

  return (
    <div className={styles.root}>
      <section className={styles.sectionLabel}>
        {t['com.affine.all-docs.display.properties']()}
      </section>
      {propertiesGroups.map(list => {
        return (
          <div className={styles.properties} key={list.type}>
            {list.properties.map(({ property }) => {
              return (
                <Button
                  key={property.id}
                  data-show={
                    displayProperties
                      ? displayProperties.includes(property.id)
                      : false
                  }
                  onClick={() => handlePropertyClick(property.id)}
                  className={styles.property}
                  data-property-id={property.id}
                >
                  <WorkspacePropertyName propertyInfo={property} />
                </Button>
              );
            })}
          </div>
        );
      })}
      <Divider size="thinner" />
      <section className={styles.sectionLabel}>
        {t['com.affine.all-docs.display.list-view']()}
      </section>
      <div className={styles.properties}>
        <Button
          className={styles.property}
          data-show={showIcon}
          onClick={toggleIcon}
        >
          {t['com.affine.all-docs.display.list-view.icon']()}
        </Button>
        <Button
          className={styles.property}
          data-show={showBody}
          onClick={toggleBody}
        >
          {t['com.affine.all-docs.display.list-view.body']()}
        </Button>
      </div>
    </div>
  );
};
