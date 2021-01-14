import React from 'react';
import clsx from 'clsx';
import moment from 'moment';
import { makeStyles } from '@material-ui/core/styles';
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
} from '@material-ui/core';
import { useQuery } from '@apollo/client';
import Router, { useRouter } from 'next/router';
import {
    InsertDriveFile as FileIcon,
    Folder as FolderIcon,
} from '@material-ui/icons';
import { useTranslation } from 'react-i18next';
import Spinner from '../Spinner';
import { FileListProps } from './FileList.d';
import { useRouterLoader } from '../../hooks';
import { ls } from '../../queries';
import { getExtensionDescriptions } from '../../utils';

const useStyles = makeStyles(theme => ({
    root: {
        paddingLeft: theme.spacing(4),
        paddingRight: theme.spacing(4),
    },
    noContent: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: 140,
    },
    name: {
        display: 'flex',
        alignItems: 'center',
        '& svg': { marginRight: 7 },
    },
    folderIcon: { fill: '#FBD405' },
    directoryRow: { cursor: 'pointer' },
}));

const FileList: React.FC<FileListProps> = ({ 'data-testid': dataTestid }) => {
    const classes = useStyles();
    const router = useRouter();
    const [t] = useTranslation('common');
    const path = router?.query?.path as string || './' as string;
    const { error, loading = true, data } = useQuery(ls, { variables: { path } });
    const customLoading = useRouterLoader(loading);
    const isEmpty = data?.ls?.length === 0;

    return (
        <Box
            className={clsx(classes.root, { [classes.noContent]: customLoading || !!error || isEmpty })}
            data-testid={dataTestid}
        >
            {!customLoading && !error && !isEmpty && (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('files.name')}</TableCell>
                            <TableCell align="right">
                                {t('files.kind')}
                            </TableCell>
                            <TableCell align="right">
                                {t('files.createdDate')}
                            </TableCell>
                            <TableCell align="right">
                                {t('files.size')}
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data?.ls?.map(datum => (
                            <TableRow
                                key={`file-row-${datum.path}`}
                                className={clsx({ [classes.directoryRow]: datum.isDirectory })}
                                hover
                                onClick={
                                    datum.isDirectory
                                        ? (): void => {
                                            // Calling Router with these options should invoke the file called ../../../pages/[path].tsx
                                            Router.push({
                                                pathname: '/',
                                                query: { path: datum.path },
                                            });
                                        } : undefined
                                }
                            >
                                <TableCell
                                    component="th"
                                    scope="row"
                                >
                                    <Box className={classes.name}>
                                        {datum.isDirectory ? (
                                            <FolderIcon className={classes.folderIcon} />
                                        ) : (
                                            <FileIcon />
                                        )}
                                        {datum.name}
                                    </Box>
                                </TableCell>
                                <TableCell align="right">
                                    {

                                        datum.isDirectory
                                            ? 'Folder'
                                            : (
                                                datum.extension
                                                    ? getExtensionDescriptions(datum.extension)[0] || 'Unknown'
                                                    : 'File'
                                            )
                                    }
                                </TableCell>
                                <TableCell align="right">
                                    {moment(datum.createdDate).format('LLLL')}

                                </TableCell>
                                <TableCell align="right">
                                    {`${Math.round((datum.size / 1024) * 10) / 10} KB`}

                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            {isEmpty && t('files.folderIsEmpty')}
            {customLoading && (
                <Spinner
                    color="secondary"
                    data-testid="file-list-spinner"
                />
            )}
            {error && t('error.unknown')}
        </Box>
    );
};

export default FileList;
