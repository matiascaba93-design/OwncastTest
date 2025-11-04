import { FC } from 'react';
import { useTranslation } from 'next-export-i18n';
import styles from './Footer.module.scss';
import { Localization } from '../../../types';

export const Footer: FC = () => {
	const { t } = useTranslation();
	return (
		<footer className={styles.footer} id="footer">
			<span className={styles.links}>
				<a href="https://owncast.online/docs" target="_blank" rel="noreferrer">
					{t(Localization.Frontend.Footer.documentation)}
				</a>
				<a href="https://owncast.online/help" target="_blank" rel="noreferrer">
					{t(Localization.Frontend.Footer.contribute)}
				</a>
				<a href="https://github.com/owncast/owncast" target="_blank" rel="noreferrer">
					{t(Localization.Frontend.Footer.source)}
				</a>
			</span>
		</footer>
	);
};
