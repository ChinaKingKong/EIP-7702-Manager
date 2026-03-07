/**
 * Localizes common RPC and wallet error messages using the i18n translation function.
 * 
 * @param {Error} error - The error object caught from a transaction or signature request
 * @param {Function} t - The translation function from I18nContext
 * @returns {string} - The localized error message
 */
export function getLocalizedError(error, t) {
    if (!error) return t('errors.unknownError', { msg: 'Unknown' });

    const message = error.message?.toLowerCase() || '';
    const shortMessage = error.shortMessage?.toLowerCase() || '';
    const fullMessage = (message + ' ' + shortMessage);

    // 1. User Rejected
    if (
        fullMessage.includes('user rejected') || 
        fullMessage.includes('user denied') ||
        error.code === 4001 ||
        error.name === 'UserRejectedRequestError'
    ) {
        return t('errors.userRejected');
    }

    // 2. Insufficient Funds
    if (
        fullMessage.includes('insufficient funds') || 
        fullMessage.includes('exceeds the balance') ||
        error.name === 'InsufficientFundsError'
    ) {
        return t('errors.insufficientFunds');
    }

    // 3. Invalid Parameters
    if (
        fullMessage.includes('invalid parameters') || 
        fullMessage.includes('invalid argument') ||
        error.code === -32602
    ) {
        return t('errors.invalidParams');
    }

    // 4. Internal Error
    if (
        fullMessage.includes('internal error') || 
        error.code === -32603
    ) {
        return t('errors.internalError');
    }

    // 5. Transaction Reverted
    if (
        fullMessage.includes('reverted') || 
        fullMessage.includes('execution reverted')
    ) {
        return t('errors.txReverted');
    }

    // 6. Not Delegated
    if (fullMessage.includes('not delegated')) {
        return t('errors.notDelegatedError');
    }

    // 7. EIP-7702 specific
    if (fullMessage.includes('eip-7702') || fullMessage.includes('eip7702')) {
        if (fullMessage.includes('external eip-7702 transactions are not supported')) {
            return t('errors.metaMaskEip7702Unsupported');
        }
        return t('errors.eip7702Error');
    }

    // Fallback to shortMessage or message
    return error.shortMessage || error.message || t('errors.unknownError', { msg: error.toString() });
}
