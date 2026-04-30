//
//  Item.swift
//  FlipTheScript
//
//  Created by Nick Kelly on 30/04/2026.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
