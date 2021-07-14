// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IBlock, MutableBlock} from './block'

type IContentBlock = IBlock
type IContentBlockWithCords = {block: IBlock, cords: {x: number, y?: number, z?: number}}

class MutableContentBlock extends MutableBlock implements IContentBlock {
}

export {IContentBlock, IContentBlockWithCords, MutableContentBlock}
