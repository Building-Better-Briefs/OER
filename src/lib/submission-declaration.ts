export const DECLARATION_DESCRIPTION =
    'I hereby certify that the material, which I now submit for assessment on the programme of [INSERT_PROGRAMME], is entirely my own work and has not been taken from the work of others except to the extent of such work which has been cited and acknowledged within the text of my own work.';

export function getDeclarationDescription(programme: string): string {
    return DECLARATION_DESCRIPTION.replaceAll('[INSERT_PROGRAMME]', programme);
}
