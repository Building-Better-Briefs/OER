import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';

const markdownStyles = StyleSheet.create({
    listItem: {
        marginBottom: 4,
        paddingLeft: 16,
        flexDirection: 'row'
    },
    listItemNested: {
        paddingLeft: 16,
        marginLeft: 11.2
    },
    listMarker: {
        marginRight: 8
    },
    listMarkerNested: {
        marginRight: 8,
        marginLeft: 11.2
    }
});

export function renderMarkdownFeedback(text: string): React.ReactElement[] {
    if (!text) return [<Text key='empty'></Text>];

    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let keyCounter = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s(.+)$/);

        if (listMatch) {
            const indent = listMatch[1];
            const marker = listMatch[2];
            const content = listMatch[3];
            const isNested = indent.length >= 2;
            const isOrdered = /^\d+\.$/.test(marker);

            let markerChar = '–';
            if (isNested && !isOrdered) {
                markerChar = '•';
            } else if (isNested && isOrdered) {
                markerChar = marker;
            }

            elements.push(
                <View
                    key={`list-${keyCounter++}`}
                    style={[
                        markdownStyles.listItem,
                        isNested ? markdownStyles.listItemNested : {}
                    ]}>
                    <Text
                        style={
                            isNested
                                ? markdownStyles.listMarkerNested
                                : markdownStyles.listMarker
                        }>
                        {markerChar}
                    </Text>
                    <Text>{content}</Text>
                </View>
            );
        } else if (trimmedLine) {
            elements.push(
                <Text key={`para-${keyCounter++}`} style={{ marginBottom: 8 }}>
                    {trimmedLine}
                </Text>
            );
        } else {
            elements.push(
                <Text key={`empty-${keyCounter++}`} style={{ marginBottom: 4 }}>
                    {' '}
                </Text>
            );
        }
    }

    return elements;
}
